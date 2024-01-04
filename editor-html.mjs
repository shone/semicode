import * as sc from './semicode.mjs';
import * as ec from './editor-core.mjs';

const caretEl = document.getElementById('caret');
let selectedSpans = [];

const spanToBlockMap = new Map([[document.body, ec.blocks]]);
const arrayToSpanMap = new Map([[ec.blocks, document.body]]);

const colors = ['yellow','orange','red','magenta','violet','blue','cyan','green'];

function getSpanForBlock(block) {
	if (Array.isArray(block)) {
		if (arrayToSpanMap.has(block)) {
			return arrayToSpanMap.get(block);
		}
		const span = document.createElement('span');
		const childSpans = block.map(getSpanForBlock);
		const childDivs = [...sc.arrayToLines(block)].map(line => {
			const div = document.createElement('div');
			div.append(...childSpans.slice(line.start, line.end+1));
			return div;
		});
		span.append(...childDivs);
		span.classList.add('nested');
		arrayToSpanMap.set(block, span);
		spanToBlockMap.set(span, block);
		return span;
	}
	const span = document.createElement('span');
	if (block === '\n') {
		span.classList.add('newline');
	} else if (block === ' ') {
		span.innerHTML = '&nbsp;';
	} else if (block === '\t') {
		span.textContent = '» ';
		span.classList.add('tab');
	} else if (block === sc.LINK) {
		span.textContent = '➤';
	} else if (block === sc.LABEL) {
		span.textContent = '"';
		span.classList.add('label');
	} else if (typeof block === 'string') {
		span.textContent = block;
	} else if (typeof block === 'symbol') {
		const bytes = sc.symbolToBytes(block);
		if (bytes.length <= 2) {
			span.textContent = sc.toHexString(bytes);
		} else {
			crypto.subtle.digest('sha-256', bytes).then(hash => {
				const hashBytes = new Uint8Array(hash);
				span.dataset.color = colors[hashBytes[0]%colors.length];
			});
			span.innerHTML = '&nbsp;&nbsp;';
		}
		span.classList.add('bytes');
	}
	spanToBlockMap.set(span, block);
	return span;
}

ec.onsplice((context, start, length, added, removed) => {
	pauseCaretBlink();
	const contextSpan = arrayToSpanMap.get(context);
	const spans = [...contextSpan.querySelectorAll(':scope > div > span')];
	const divs = [...contextSpan.querySelectorAll(':scope > div')];
	const addedSpans = added.map(getSpanForBlock);
	const removedSpans = spans.splice(start, length, ...addedSpans);
	for (const removedSpan of removedSpans) {
		if (removedSpan?.parentElement?.parentElement === contextSpan) {
			removedSpan.remove();
		}
	}

	const lines = [...sc.arrayToLines(context)];
	if (divs.length < lines.length) {
		divs.push(...Array.from(Array(lines.length-divs.length), () => document.createElement('div')));
	} else if (divs.length > lines.length) {
		divs.splice(lines.length-divs.length).forEach(div => div.remove());
	}
	contextSpan.append(...divs);
	for (const [index, line] of lines.entries()) {
		divs[index].append(...spans.slice(line.start, line.end+1));
	}

	setCaretElPosition(context, ec.caretPosition);
	caretEl.scrollIntoView({block: 'nearest', inline: 'nearest'});

	selectedSpans.forEach(span => span.classList.remove('selected'));

	updateLabels();
	applyRowColumnRules(context);
});

ec.oncaretmove((context, caretPosition, selectPosition) => {
	pauseCaretBlink();
	setCaretElPosition(context, ec.caretPosition);
	caretEl.scrollIntoView({block: 'nearest', inline: 'nearest'});

	selectedSpans.forEach(span => span.classList.remove('selected'));

	const indexMin = Math.min(caretPosition, selectPosition);
	const indexMax = Math.max(caretPosition, selectPosition);
	const contextSpan = arrayToSpanMap.get(context);
	selectedSpans = [...contextSpan.querySelectorAll(':scope > div > span')].filter((span, index) => index >= indexMin && index < indexMax);
	selectedSpans.forEach(span => span.classList.add('selected'));
});

function setCaretElPosition(context, position) {
	const contextSpan = arrayToSpanMap.get(context);
	const spans = [...contextSpan.querySelectorAll(':scope > div > span')];
	if (spans.length === 0) {
		contextSpan.querySelector('div').prepend(caretEl);
	} else if (position < spans.length) {
		spans[position].before(caretEl);
	} else {
		const divs = [...contextSpan.querySelectorAll(':scope > div')];
		divs[divs.length-1].append(caretEl);
	}
}

let caretBlinkTimeout = null;
function pauseCaretBlink() {
	caretEl.classList.add('pause-blink');
	if (caretBlinkTimeout !== null) {
		clearTimeout(caretBlinkTimeout);
	}
	caretBlinkTimeout = setTimeout(() => {
		caretEl.classList.remove('pause-blink');
		caretBlinkTimeout = null;
	}, 500);
}

function updateLabels() {
	const triples = [...sc.arrayToTriples(ec.blocks)];
	const blockToLabelMap = new Map();
	blockToLabelMap.set(ec.GROW_ROW, 'GR');
	blockToLabelMap.set(ec.SHRINK_ROW, 'SR');
	blockToLabelMap.set(ec.GROW_COLUMN, 'GC');
	for (const triple of triples) {
		if (typeof triple[0] === 'symbol' && triple[1] === sc.LABEL && (typeof triple[2] === 'string')) {
			blockToLabelMap.set(triple[0], triple[2]);
		}
	}
	for (const [span, block] of spanToBlockMap.entries()) {
		if (typeof block === 'symbol') {
			const label = blockToLabelMap.get(block);
			if (label) {
				span.textContent = label;
			} else {
				span.innerHTML = '&nbsp;&nbsp;';
			}
		}
	}
}

function applyRowColumnRules(array) {
	const contextSpan = arrayToSpanMap.get(array);
	const spans = [...contextSpan.querySelectorAll(':scope > div > span')];
	let growRow = false;
	let growColumn = false;
	for (let i=0; i<array.length; i++) {
		switch (array[i]) {
			case ec.GROW_ROW:    growRow    = true;  continue;
			case ec.SHRINK_ROW:  growRow    = false; continue;
			case ec.GROW_COLUMN: growColumn = true;  continue;
		}
		spans[i].classList.toggle('grow-row', growRow);
		spans[i].parentElement.classList.toggle('grow-column', growColumn);
		if (Array.isArray(array[i])) {
			applyRowColumnRules(array[i]);
		}
	}
}

function getCaretPositionForPointerEvent(event) {
	let span = null;
	if (event.target.tagName === 'SPAN') {
		span = event.target;
	} else if (event.target.tagName === 'DIV') {
		span = [...event.target.querySelectorAll(':scope > span')].at(-1);
	}
	if (!span) {
		return [null, null];
	}
	const contextSpan = span.parentElement.parentElement;
	const siblingSpans = [...contextSpan.querySelectorAll(':scope > div > span')];
	const index = siblingSpans.indexOf(span);
	if (index === -1) {
		return [null, null];
	}
	const contextPath = [];
	for (let parentSpan = contextSpan; !!parentSpan; parentSpan = parentSpan?.parentElement?.parentElement) {
		contextPath.unshift(spanToBlockMap.get(parentSpan));
	}
	return [contextPath, index];
}

document.body.onpointerdown = downEvent => {
	if (document.body.onpointermove !== null) {
		return;
	}
	const [contextPath, position] = getCaretPositionForPointerEvent(downEvent);
	if (position !== null) {
		ec.moveCaret(position, 'clear-selection', contextPath);
	}
	// document.body.setPointerCapture(downEvent.pointerId);
	document.body.onpointermove = moveEvent => {
		const [newContextPath, position] = getCaretPositionForPointerEvent(moveEvent);
		if (position !== null && newContextPath.at(-1) === contextPath.at(-1)) {
			ec.moveCaret(position, 'keep-selection', contextPath);
		}
	}
	document.body.onpointerup = document.body.onpointercancel = upEvent => {
		document.body.onpointermove = null;
		document.body.onpointerup = null;
		document.body.onpointercancel = null;
	}
}

document.body.ondblclick = event => {
	const [contextPath, position] = getCaretPositionForPointerEvent(event);
	if (position !== null) {
		ec.selectWordAtPosition(position, contextPath);
	}
}

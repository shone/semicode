import * as sc from './semicode.mjs';
import * as ec from './editor-core.mjs';

const spans = [];
const divs = [];
const caretEl = document.getElementById('caret');
const spanToBlockMap = new Map();

const colors = ['yellow','orange','red','magenta','violet','blue','cyan','green'];

function makeSpanForBlock(block) {
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
			span.textContent = toHexString(bytes);
		} else {
			crypto.subtle.digest('sha-256', bytes).then(hash => {
				const hashBytes = new Uint8Array(hash);
				span.dataset.color = colors[hashBytes[0]%colors.length];
			});
			span.innerHTML = '&nbsp;&nbsp;';
		}
		span.classList.add('bytes');
	} else if (Array.isArray(block)) {
		span.append(...block.map(makeSpanForBlock));
		span.classList.add('nested');
	}
	spanToBlockMap.set(span, block);
	return span;
}

ec.onsplice((start, length, added, removed) => {
	pauseCaretBlink();
	const newSpans = added.map(makeSpanForBlock);
	const removedSpans = spans.splice(start, length, ...newSpans);
	removedSpans.forEach(span => span.remove());

	const lines = [...sc.arrayToLines(ec.blocks)];
	if (divs.length < lines.length) {
		divs.push(...Array.from(Array(lines.length-divs.length), () => document.createElement('div')));
	} else if (divs.length > lines.length) {
		divs.splice(lines.length-divs.length).forEach(div => div.remove());
	}
	document.body.append(...divs);
	for (const [index, line] of lines.entries()) {
		divs[index].append(...spans.slice(line.start, line.end+1));
	}

	setCaretElPosition(ec.caretPosition);
	caretEl.scrollIntoView({block: 'nearest', inline: 'nearest'});

	updateLabels();
});

ec.oncaretmove((caretPosition, selectPosition) => {
	pauseCaretBlink();
	setCaretElPosition(ec.caretPosition);
	caretEl.scrollIntoView({block: 'nearest', inline: 'nearest'});

	const indexMin = Math.min(caretPosition, selectPosition);
	const indexMax = Math.max(caretPosition, selectPosition);
	spans.forEach((span, index) => span.classList.toggle('selected', index >= indexMin && index < indexMax));
});

function setCaretElPosition(position) {
	if (spans.length === 0) {
		document.body.prepend(caretEl);
	} else if (position < spans.length) {
		spans[position].before(caretEl);
	} else {
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
	blockToLabelMap.set(ec.GROW_COLUMN, 'GC');
	for (const triple of triples) {
		if (typeof triple[0] === 'symbol' && triple[1] === sc.LABEL && (typeof triple[2] === 'string')) {
			blockToLabelMap.set(triple[0], triple[2]);
		}
	}
	for (const span of spans) {
		const block = spanToBlockMap.get(span);
		if (typeof block === 'symbol') {
			const label = blockToLabelMap.get(block);
			if (label) {
				span.textContent = label;
			} else {
				span.innerHTML = '&nbsp;&nbsp;';
			}
		}
	}
	let growRow = false;
	let growColumn = false;
	for (let i=0; i<ec.blocks.length; i++) {
		if (ec.blocks[i] === ec.GROW_ROW) {
			growRow = true;
			continue;
		}
		if (ec.blocks[i] === ec.GROW_COLUMN) {
			growColumn = true;
			continue;
		}
		spans[i].classList.toggle('grow-row', growRow);
		spans[i].parentElement.classList.toggle('grow-column', growColumn);
	}
}

function getCaretPositionForPointerEvent(event) {
	let span = event.target.closest('span');
	if (!span) {
		const div = event.target.closest('div');
		if (div) {
			span = div.children[div.children.length-1];
		}
	}
	if (!span) {
		return null;
	}
	const index = spans.indexOf(span);
	if (index === -1) {
		return null;
	}
	return index;
}

document.body.onpointerdown = downEvent => {
	if (document.body.onpointermove !== null) {
		return;
	}
	const position = getCaretPositionForPointerEvent(downEvent);
	if (position !== null) {
		ec.moveCaret(position);
	}
	// document.body.setPointerCapture(downEvent.pointerId);
	document.body.onpointermove = moveEvent => {
		const position = getCaretPositionForPointerEvent(moveEvent);
		if (position !== null) {
			ec.moveCaret(position, true);
		}
	}
	document.body.onpointerup = document.body.onpointercancel = upEvent => {
		document.body.onpointermove = null;
		document.body.onpointerup = null;
		document.body.onpointercancel = null;
	}
}

document.body.ondblclick = event => {
	const position = getCaretPositionForPointerEvent(event);
	if (position !== null) {
		ec.selectWordAtPosition(position);
	}
}

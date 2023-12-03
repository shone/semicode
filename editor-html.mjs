import * as sc from './semicode.mjs';
import * as ec from './editor-core.mjs';

const spans = [];
const spanToBlockMap = new Map();

const randomByteArrayColors = [
	'#b58900', // yellow
	'#cb4b16', // orange
	'#dc322f', // red
	'#d33682', // magenta
	'#6c71c4', // violet
	'#268bd2', // blue
	'#2aa198', // cyan
	'#859900', // green
]

function makeSpanForBlock(block) {
	const span = document.createElement('span');
	if (block === '\n') {
		span.innerHTML = '<br>';
	} else if (block === ' ') {
		span.innerHTML = '&nbsp;';
	} else if (block === '\t') {
		span.textContent = '» ';
		span.classList.add('whitespace');
	} else if (block === sc.LINK) {
		span.textContent = '➤';
	} else if (block === ec.LABEL) {
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
				span.style.background = randomByteArrayColors[hashBytes[0]%randomByteArrayColors.length];
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
	const prevCaretSpan = document.body.querySelector('[data-caret]');
	if (prevCaretSpan !== null) {
		delete prevCaretSpan.dataset.caret;
	}
	if (newSpans.length > 0) {
		if (start === 0) {
			document.body.prepend(...newSpans);
		} else {
			spans[start-1].after(...newSpans);
		}
	}
	if (ec.caretPosition > 0) {
		spans[ec.caretPosition-1].dataset.caret = 'after';
	} else if (ec.blocks.length > 0) {
		spans[0].dataset.caret = 'before';
	}
	document.body.classList.toggle('empty', ec.blocks.length === 0);
	updateLabels();
});

ec.oncaretmove((caretPosition, selectPosition) => {
	pauseCaretBlink();
	const prevCaretSpan = document.body.querySelector('[data-caret]');
	if (prevCaretSpan !== null) {
		delete prevCaretSpan.dataset.caret;
	}
	if (caretPosition === 0) {
		spans[0].dataset.caret = 'before';
	} else {
		spans[caretPosition-1].dataset.caret = 'after';
	}
	const indexMin = Math.min(caretPosition, selectPosition);
	const indexMax = Math.max(caretPosition, selectPosition);
	spans.forEach((span, index) => span.classList.toggle('selected', index >= indexMin && index < indexMax));
});

let caretBlinkTimeout = null;
function pauseCaretBlink() {
	document.body.classList.add('pause-caret-blink');
	if (caretBlinkTimeout !== null) {
		clearTimeout(caretBlinkTimeout);
	}
	caretBlinkTimeout = setTimeout(() => {
		document.body.classList.remove('pause-caret-blink');
		caretBlinkTimeout = null;
	}, 500);
}

function updateLabels() {
	const triples = [...sc.arrayToTriples(ec.blocks)];
	const blockToLabelMap = new Map();
	for (const triple of triples) {
		if (typeof triple[0] === 'symbol' && triple[1] === ec.LABEL && (typeof triple[2] === 'string')) {
			blockToLabelMap.set(triple[0], triple[2]);
		}
	}
	console.log(triples);
	console.log(blockToLabelMap);
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
}

function getCaretPositionForPointerEvent(event) {
	const span = event.target.closest('span');
	if (!span || span.parentElement !== document.body) {
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

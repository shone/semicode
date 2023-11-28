const LINK = '\uEEEE';
const LABEL = Symbol('LABEL');
const whitespaceChars = new Set([' ', '\n', '\t', LINK]);

const blocks = [];
let caretPosition = 0;
let selectPosition = 0;

fetch('semicode.txt').then(async response => {
	const text = await response.text();
	insertAtCaret([...text]);
});

const keyActionMap = {
	AltArrowRight:       () => insertAtCaret([LINK]),
	'Alt\'':             () => insertAtCaret([LABEL]),
	'Shift ':            () => insertAtCaret([Symbol()]),
	ArrowRight:          () => moveCaret(caretPosition+1),
	ArrowLeft:           () => moveCaret(caretPosition-1),
	CtrlArrowRight:      () => moveCaretWord(true),
	CtrlArrowLeft:       () => moveCaretWord(false),
	CtrlShiftArrowRight: () => moveCaretWord(true, true),
	CtrlShiftArrowLeft:  () => moveCaretWord(false, true),
	ArrowUp:             () => moveCaretLine('up'),
	ArrowDown:           () => moveCaretLine('down'),
	ShiftArrowUp:        () => moveCaretLine('up', true),
	ShiftArrowDown:      () => moveCaretLine('down', true),
	ShiftArrowRight:     () => moveCaret(caretPosition+1,true),
	ShiftArrowLeft:      () => moveCaret(caretPosition-1,true),
	Home:                () => moveCaretLineStart(),
	End:                 () => moveCaretLineEnd(),
	ShiftHome:           () => moveCaretLineStart(true),
	ShiftEnd:            () => moveCaretLineEnd(true),
	CtrlHome:            () => moveCaret(0),
	CtrlEnd:             () => moveCaret(blocks.length),
	ShiftEnter:          () => nestSelection(),
	CtrlShiftEnter:      () => unnest(),
	Backspace:           () => deleteAtCaret(true),
	Delete:              () => deleteAtCaret(false),
	Enter:               () => insertAtCaret(['\n']),
	Ctrla:               () => selectAll(),
	Ctrlc:               () => copy(),
	Tab:                 () => insertAtCaret(['\t']),
	Escape:              () => deselect(),
}

const blockToLabelMap = new Map();
blockToLabelMap.set(LABEL, 'LABEL');

function getBlockDisplayText(block) {
	if (typeof block === 'string') {
		return block;
	}
	if (typeof block === 'symbol') {
		return blockToLabelMap.get(block) || '(symbol)';
	}
	return '(unknown)';
}

const spanToBlockMap = new Map();

const spans = blocks.map(makeSpanForBlock);
document.body.append(...spans);
document.body.classList.toggle('empty', blocks.length === 0);
if (blocks.length > 0) {
	spans[0].dataset.caret = 'before';
}

updateLabels();

function getTriples() {
	let i=0;
	function getNode() {
		let node = blocks[i];
		while (node === '\n') {
			node = blocks[++i];
		}
		if (typeof node === 'string') {
			while (typeof blocks[i+1] === 'string') {
				node += blocks[i+1];
				i++;
			}
		}
		i++;
		return node;
	}
	function getTriple() {
		let tripleIndex = 0;
		const triple = [null, null, null];
		while (i<blocks.length) {
			const node = getNode();
			if (node === LINK && triple[tripleIndex] !== null) {
				tripleIndex++;
			} else {
				triple[tripleIndex] = node;
				if (tripleIndex === 2) {
					break;
				}
			}
		}
		return triple;
	}
	const triples = [];
	while (i<blocks.length) {
		const triple = getTriple();
		if (triple.some(node => node === null)) {
			break;
		}
		triples.push(triple);
	}
	return triples;
}

function updateLabels() {
	const triples = getTriples();
	for (const triple of triples) {
		if (triple[1] === LABEL && (typeof triple[2] === 'string')) {
			blockToLabelMap.set(triple[0], triple[2]);
		}
	}
	for (const span of spans) {
		const block = spanToBlockMap.get(span);
		if (typeof block === 'symbol' && block !== LINK && block !== LABEL) {
			const label = blockToLabelMap.get(block);
			if (label) {
				span.textContent = label;
			} else {
				span.textContent = '(symbol)';
			}
		}
	}
}

function updateSelectionDisplay() {
	const indexMin = Math.min(caretPosition, selectPosition);
	const indexMax = Math.max(caretPosition, selectPosition);
	spans.forEach((span, index) => span.classList.toggle('selected', index >= indexMin && index < indexMax));
}

function makeSpanForBlock(block) {
	const span = document.createElement('span');
	switch (block) {
		case '\n': span.innerHTML = '<br>';   break;
		case '\t': span.textContent = '» ';   break;
		case LINK: span.textContent = '➤';   break;
		case ' ':  span.innerHTML = '&nbsp;'; break;
		default:
			if (typeof block === 'string') {
				span.textContent = block;
			} else if (typeof block === 'symbol') {
				span.textContent = '(symbol)';
			} else if (Array.isArray(block)) {
				span.append(...block.map(makeSpanForBlock));
				span.classList.add('nested');
			}
	}
	if (block === '\t') {
		span.classList.add('whitespace');
	}
	spanToBlockMap.set(span, block);
	if (typeof block === 'symbol' && block !== LINK) {
		span.classList.add('symbol');
	}
	return span;
}

function insertAtCaret(blocks_) {
	pauseCaretBlink();
	if (blocks_.length === 0) {
		return;
	}
	const spliceStart = Math.min(caretPosition, selectPosition);
	const spliceLength = Math.abs(caretPosition - selectPosition);
	blocks.splice(spliceStart, spliceLength, ...blocks_);
	const newSpans = blocks_.map(makeSpanForBlock);
	const removedSpans = spans.splice(spliceStart, spliceLength, ...newSpans);
	removedSpans.forEach(span => span.remove());
	const prevCaretSpan = document.body.querySelector('[data-caret]');
	if (prevCaretSpan !== null) {
		delete prevCaretSpan.dataset.caret;
	}
	newSpans[newSpans.length-1].dataset.caret = 'after';
	document.body.classList.remove('empty');
	if (spliceStart === 0) {
		document.body.prepend(...newSpans);
	} else {
		spans[spliceStart-1].after(...newSpans);
	}
	caretPosition = spliceStart + blocks_.length;
	selectPosition = caretPosition;
}

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

function clamp(f, min, max) {
	f = Math.min(f, max);
	f = Math.max(f, min);
	return f;
}

function moveCaret(position, keepSelection=false) {
	pauseCaretBlink();

	position = clamp(position, 0, blocks.length);

	if (!keepSelection) {
		selectPosition = position;
	}

	if (caretPosition !== position) {
		const prevCaretSpan = document.body.querySelector('[data-caret]');
		if (prevCaretSpan !== null) {
			delete prevCaretSpan.dataset.caret;
		}
		caretPosition = position;
		if (caretPosition === 0) {
			spans[0].dataset.caret = 'before';
		} else {
			spans[caretPosition-1].dataset.caret = 'after';
		}
	}

	updateSelectionDisplay();
}

function getLineIndicesAtPosition(position) {
	let startIndex = position;
	let endIndex = position;
	while (startIndex > 0 && blocks[startIndex-1] !== '\n') {
		startIndex--;
	}
	while (endIndex < blocks.length && blocks[endIndex] !== '\n') {
		endIndex++;
	}
	return [startIndex, endIndex];
}

function moveCaretLineStart(keepSelection=false) {
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPosition);
	moveCaret(lineStart, keepSelection);
}
function moveCaretLineEnd(keepSelection=false) {
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPosition);
	moveCaret(lineEnd, keepSelection);
}

function moveCaretWord(forwards=true, keepSelection=false) {
	let i = caretPosition;
	if (forwards) {
		// Find next whitespace char
		while (i < blocks.length && !whitespaceChars.has(blocks[i])) i++;
		// Find next non-whitespace char
		while (i < blocks.length && whitespaceChars.has(blocks[i])) i++;
	} else {
		// Skip preceding whitespace
		while (i > 0 && whitespaceChars.has(blocks[i-1])) i--;
		// Find previous whitespace char
		while (i > 0 && !whitespaceChars.has(blocks[i-1])) i--;
	}
	moveCaret(i, keepSelection);
}

function moveCaretLine(direction='down', keepSelection=false) {
	pauseCaretBlink();
	const [currentLineStart, currentLineEnd] = getLineIndicesAtPosition(caretPosition);
	if (direction === 'up' && currentLineStart === 0) {
		moveCaret(0, keepSelection);
		return;
	}
	if (direction === 'down' && currentLineEnd === blocks.length) {
		moveCaret(blocks.length, keepSelection);
		return;
	}
	const caretX = caretPosition - currentLineStart;
	const targetLinePosition = (direction==='down') ? (currentLineEnd+1) : (currentLineStart-1);
	const [targetLineStart, targetLineEnd] = getLineIndicesAtPosition(targetLinePosition);
	moveCaret(targetLineStart + caretX, keepSelection);
}

function deleteAtCaret(backspace=true) {
	pauseCaretBlink();
	if (blocks.length === 0) {
		return;
	}

	let spliceStart = Math.min(selectPosition, caretPosition);
	let spliceLength = Math.abs(selectPosition - caretPosition);
	if (spliceLength === 0) {
		if (backspace && spliceStart > 0) {
			spliceStart--;
			spliceLength = 1;
		} else if (!backspace && spliceStart < blocks.length) {
			spliceLength = 1;
		}
	}

	if (spliceLength === 0) {
		return;
	}

	blocks.splice(spliceStart, spliceLength);
	const deletedSpans = spans.splice(spliceStart, spliceLength);
	deletedSpans.forEach(span => span.remove());
	caretPosition = spliceStart;
	selectPosition = spliceStart;
	if (spliceStart > 0) {
		spans[spliceStart-1].dataset.caret = 'after';
	} else if (spans.length > 0) {
		spans[0].dataset.caret = 'before';
	}

	document.body.classList.toggle('empty', blocks.length === 0);
}

function nestSelection() {
	pauseCaretBlink();

	const spliceStart = Math.min(selectPosition, caretPosition);
	const spliceLength = Math.abs(selectPosition - caretPosition);
	const nestedBlock = [];
	nestedBlock.push(...blocks.splice(spliceStart, spliceLength, nestedBlock));
	const nestedSpan = makeSpanForBlock(nestedBlock);
	if (spliceStart > 0) {
		spans[spliceStart-1].after(nestedSpan);
	} else {
		document.body.prepend(nestedSpan);
	}
	nestedSpan.classList.add('selected');
	nestedSpan.dataset.caret = 'after'
	const deletedSpans = spans.splice(spliceStart, spliceLength, nestedSpan);
	deletedSpans.forEach(span => span.remove());
	selectPosition = spliceStart;
	caretPosition = spliceStart + 1;
}

function unnestBlock(blockIndex) {
	const block = blocks[blockIndex];
	if (!Array.isArray(block)) {
		return;
	}
	blocks.splice(blockIndex, 1, ...block);
	const childSpans = [...spans[blockIndex].children];
	const deletedSpans = spans.splice(blockIndex, 1, ...childSpans);
	deletedSpans[0].remove();
	if (blockIndex > 0) {
		spans[blockIndex-1].after(...childSpans);
	} else {
		document.body.prepend(...childSpans);
	}
	const selectStart = Math.min(selectPosition, caretPosition);
	const selectEnd = Math.max(selectPosition, caretPosition);
	if (blockIndex >= selectStart && blockIndex < selectEnd) {
		childSpans.forEach(span => span.classList.add('selected'));
	}
	if (caretPosition >= blockIndex) {
		caretPosition += block.length - 1;
	}
	if (selectPosition >= blockIndex) {
		selectPosition += block.length - 1;
	}
}
function unnest() {
	function getNestedBlock() {
		const selectionStart = Math.min(selectPosition, caretPosition);
		const selectionEnd = Math.max(selectPosition, caretPosition);
		for (let i=selectionStart; i<selectionEnd; i++) {
			if (Array.isArray(blocks[i])) {
				return i;
			}
		}
		return null;
	}
	while (true) {
		const blockIndex = getNestedBlock();
		if (blockIndex === null) {
			return;
		}
		unnestBlock(blockIndex);
	}
}

function selectAll() {
	pauseCaretBlink();
	if (blocks.length === 0) {
		return;
	}
	caretPosition = blocks.length;
	selectPosition = 0;
	spans.forEach(span => span.classList.add('selected'));
	const prevCaretSpan = document.body.querySelector('[data-caret]');
	if (prevCaretSpan !== null) {
		delete prevCaretSpan.dataset.caret;
	}
	spans[spans.length-1].dataset.caret = 'after';
}

function deselect() {
	pauseCaretBlink();
	if (selectPosition !== caretPosition) {
		selectPosition = caretPosition;
		spans.forEach(span => span.classList.remove('selected'));
	}
}

function selectWordAtPosition(position) {
	pauseCaretBlink();
	if (whitespaceChars.has(blocks[position])) {
		return;
	}
	let wordStart = position;
	while (wordStart > 0 && !whitespaceChars.has(blocks[wordStart-1])) {
		wordStart--;
	}
	let wordEnd = position;
	while (wordEnd < blocks.length && !whitespaceChars.has(blocks[wordEnd])) {
		wordEnd++;
	}
	selectPosition = wordStart;
	caretPosition = wordEnd;

	const prevCaretSpan = document.body.querySelector('[data-caret]');
	if (prevCaretSpan !== null) {
		delete prevCaretSpan.dataset.caret;
	}
	if (caretPosition > 0) {
		spans[caretPosition].dataset.caret = 'before';
	} else {
		spans[0].dataset.caret = 'before';
	}

	const selectionStart = Math.min(selectPosition, caretPosition);
	const selectionEnd = Math.max(selectPosition, caretPosition);
	spans.forEach((span, index) => span.classList.toggle('selected', index >= selectionStart && index < selectionEnd));
}

function copy() {
	const startIndex = Math.min(caretPosition, selectPosition);
	const endIndex = Math.max(caretPosition, selectPosition);
	navigator.clipboard.writeText(blocks.slice(startIndex, endIndex).join(''));
}

window.onkeydown = event => {
	const keyCombo = (
		(event.ctrlKey   ? 'Ctrl'  : '') +
		(event.shiftKey  ? 'Shift' : '') +
		(event.altKey    ? 'Alt'   : '') +
		(event.metaKey   ? 'Meta'  : '') +
		event.key
	);
	let action = keyActionMap[keyCombo];
	if (!action && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
		action = () => insertAtCaret([event.key]);
	}
	if (action) {
		event.preventDefault();
		action();
		updateLabels();
	}
}

document.body.onpaste = async event => {
	const stringItems = [...event.clipboardData.items].filter(item => item.kind === 'string');
	const strings = await Promise.all(stringItems.map(item => new Promise(resolve => item.getAsString(resolve))));
	insertAtCaret([...strings.join('')]);
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
		moveCaret(position);
	}
	// document.body.setPointerCapture(downEvent.pointerId);
	document.body.onpointermove = moveEvent => {
		const position = getCaretPositionForPointerEvent(moveEvent);
		if (position !== null) {
			moveCaret(position, true);
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
		selectWordAtPosition(position);
	}
}

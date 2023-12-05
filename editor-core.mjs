import * as sc from './semicode.mjs';

export const blocks = [];
export let caretPosition = 0;
export let selectPosition = 0;

export const GROW_ROW = Symbol();
export const GROW_COLUMN = Symbol();

const whitespaceChars = new Set([' ', '\n', '\t', sc.LINK]);

const onspliceCallbacks = [];
export function onsplice(callback) {
	onspliceCallbacks.push(callback);
}

const oncaretmoveCallbacks = [];
export function oncaretmove(callback) {
	oncaretmoveCallbacks.push(callback);
}

export function insertAtCaret(blocks_) {
	if (blocks_.length === 0) {
		return;
	}
	const spliceStart = Math.min(caretPosition, selectPosition);
	const spliceLength = Math.abs(caretPosition - selectPosition);
	const removedBlocks = blocks.splice(spliceStart, spliceLength, ...blocks_);
	caretPosition = spliceStart + blocks_.length;
	selectPosition = caretPosition;
	onspliceCallbacks.forEach(callback => callback(spliceStart, spliceLength, blocks_, removedBlocks));
}

export function moveCaret(position, keepSelection=false) {
	caretPosition = clamp(position, 0, blocks.length);
	if (!keepSelection) {
		selectPosition = caretPosition;
	}
	oncaretmoveCallbacks.forEach(callback => callback(caretPosition, selectPosition));
}

export function getLineIndicesAtPosition(position) {
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

export function moveCaretLineStart(keepSelection=false) {
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPosition);
	moveCaret(lineStart, keepSelection);
}
export function moveCaretLineEnd(keepSelection=false) {
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPosition);
	moveCaret(lineEnd, keepSelection);
}

export function moveCaretWord(forwards=true, keepSelection=false) {
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

export function moveCaretLine(direction='down', keepSelection=false) {
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

export function deleteAtCaret(backspace=true) {
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

	const deletedBlocks = blocks.splice(spliceStart, spliceLength);
	caretPosition = spliceStart;
	selectPosition = spliceStart;
	onspliceCallbacks.forEach(callback => callback(spliceStart, spliceLength, [], deletedBlocks));

	return deletedBlocks;
}

export function nestSelection() {
	const spliceStart = Math.min(selectPosition, caretPosition);
	const spliceLength = Math.abs(selectPosition - caretPosition);
	const nestedBlock = [];
	const blocksRemoved = blocks.splice(spliceStart, spliceLength, nestedBlock)
	nestedBlock.push(...blocksRemoved);
	selectPosition = spliceStart;
	caretPosition = spliceStart + 1;
	onspliceCallbacks.forEach(callback => callback(spliceStart, spliceLength, [nestedBlock], blocksRemoved));
}

export function unnestBlock(blockIndex) {
	const block = blocks[blockIndex];
	if (!Array.isArray(block)) {
		return;
	}
	const blocksRemoved = blocks.splice(blockIndex, 1, ...block);
	if (caretPosition >= blockIndex) {
		caretPosition += block.length - 1;
	}
	if (selectPosition >= blockIndex) {
		selectPosition += block.length - 1;
	}
	onspliceCallbacks.forEach(callback => callback(blockIndex, 1, block, blocksRemoved));
}
export function unnest() {
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

export function selectAll() {
	if (blocks.length === 0) {
		return;
	}
	caretPosition = blocks.length;
	selectPosition = 0;
	oncaretmoveCallbacks.forEach(callback => callback(caretPosition, selectPosition));
}

export function deselect() {
	if (selectPosition !== caretPosition) {
		selectPosition = caretPosition;
		oncaretmoveCallbacks.forEach(callback => callback(caretPosition, selectPosition));
	}
}

export function selectWordAtPosition(position) {
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
	oncaretmoveCallbacks.forEach(callback => callback(caretPosition, selectPosition));
}

function compareArrayBuffers(a, b) {
	if (a.byteLength !== b.byteLength) {
		return false;
	}
	const uint32A = new Uint32Array(a);
	const uint32B = new Uint32Array(b);
	for (let i=0; i<uint32A.length; i++) {
		if (uint32A[i] !== uint32B[i]) {
			return false;
		}
	}
	return true;
}

function clamp(f, min, max) {
	f = Math.min(f, max);
	f = Math.max(f, min);
	return f;
}

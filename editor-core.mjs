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

export function splice(start, deleteCount, ...blocks_) {
	if (deleteCount === 0 && blocks_.length === 0) {
		return;
	}
	const deletedBlocks = blocks.splice(start, deleteCount, ...blocks_);
	onspliceCallbacks.forEach(callback => callback(start, deleteCount, blocks_, deletedBlocks));
	return deletedBlocks;
}

export function insertAtCaret(blocks_) {
	if (blocks_.length === 0) {
		return;
	}
	const spliceStart = Math.min(caretPosition, selectPosition);
	const spliceLength = Math.abs(caretPosition - selectPosition);
	caretPosition = spliceStart + blocks_.length;
	selectPosition = caretPosition;
	return splice(spliceStart, spliceLength, ...blocks_);
}

export function moveCaret(position, selection='clear-selection') {
	caretPosition = clamp(position, 0, blocks.length);
	if (selection === 'clear-selection') {
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

export function getSelectedLines() {
	let start = Math.min(caretPosition, selectPosition);
	let end = Math.max(caretPosition, selectPosition);
	while (start > 0 && blocks[start-1] !== '\n') {
		start--;
	}
	while (end < blocks.length && blocks[end] !== '\n') {
		end++;
	}
	return [start, end];
}

export function moveCaretLineStart(selection='clear-selection') {
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPosition);
	moveCaret(lineStart, selection);
}
export function moveCaretLineEnd(selection='clear-selection') {
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPosition);
	moveCaret(lineEnd, selection);
}

export function moveCaretWord(direction='forwards', selection='clear-selection') {
	let i = caretPosition;
	if (direction === 'forwards') {
		// Find next whitespace char
		while (i < blocks.length && !whitespaceChars.has(blocks[i])) i++;
		// Find next non-whitespace char
		while (i < blocks.length && whitespaceChars.has(blocks[i])) i++;
	} else if (direction === 'backwards') {
		// Skip preceding whitespace
		while (i > 0 && whitespaceChars.has(blocks[i-1])) i--;
		// Find previous whitespace char
		while (i > 0 && !whitespaceChars.has(blocks[i-1])) i--;
	}
	moveCaret(i, selection);
}

export function moveCaretLine(direction='down', selection='clear-selection') {
	const [currentLineStart, currentLineEnd] = getLineIndicesAtPosition(caretPosition);
	if (direction === 'up' && currentLineStart === 0) {
		moveCaret(0, selection);
		return;
	}
	if (direction === 'down' && currentLineEnd === blocks.length) {
		moveCaret(blocks.length, selection);
		return;
	}
	const caretX = caretPosition - currentLineStart;
	const targetLinePosition = (direction==='down') ? (currentLineEnd+1) : (currentLineStart-1);
	const [targetLineStart, targetLineEnd] = getLineIndicesAtPosition(targetLinePosition);
	moveCaret(Math.min(targetLineStart + caretX, targetLineEnd), selection);
}

export function deleteAtCaret(direction='backwards') {
	if (blocks.length === 0) {
		return;
	}

	let spliceStart = Math.min(selectPosition, caretPosition);
	let spliceLength = Math.abs(selectPosition - caretPosition);
	if (spliceLength === 0) {
		if (direction==='backwards' && spliceStart > 0) {
			spliceStart--;
			spliceLength = 1;
		} else if (direction==='forwards' && spliceStart < blocks.length) {
			spliceLength = 1;
		}
	}

	if (spliceLength === 0) {
		return;
	}

	caretPosition = spliceStart;
	selectPosition = spliceStart;
	return splice(spliceStart, spliceLength);
}

export function duplicateLines(direction='down') {
	const [start, end] = getSelectedLines();
	if (start === end) {
		return;
	}
	const lines = blocks.slice(start, end+1);
	if (direction === 'down') {
		if (end === blocks.length) {
			lines.unshift('\n');
		}
		caretPosition += lines.length;
		selectPosition += lines.length;
		splice(end+1, 0, ...lines);
	} else {
		if (end === blocks.length) {
			lines.push('\n');
		}
		splice(start, 0, ...lines);
	}
}

export function deleteLineAtCaret() {
	if (blocks.length === 0) {
		return;
	}
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPosition);
	caretPosition = lineStart;
	selectPosition = lineStart;
	return splice(lineStart, (lineEnd-lineStart) + 1);
}

export function moveLines(direction='down') {
	const [start, end] = getSelectedLines();
	if (direction==='down' && end===blocks.length) {
		return;
	}
	if (direction==='up' && start===0) {
		return;
	}
	const [swapLineStart, swapLineEnd] = getLineIndicesAtPosition(direction==='down'?(end+1):(start-1));
	if (direction === 'down') {
		caretPosition += (swapLineEnd-swapLineStart) + 1;
		selectPosition += (swapLineEnd-swapLineStart) + 1;
		const removedBlocks = splice(swapLineStart, (swapLineEnd-swapLineStart)+1);
		if (removedBlocks.length===0 || removedBlocks[removedBlocks.length-1]!=='\n') {
			removedBlocks.push('\n');
		}
		splice(start, 0, ...removedBlocks);
	} else if (direction === 'up') {
		caretPosition -= (end-start) + 1;
		selectPosition -= (end-start) + 1;
		const removedBlocks = splice(start, (end-start)+1);
		if (removedBlocks.length===0 || removedBlocks[removedBlocks.length-1]!=='\n') {
			removedBlocks.push('\n');
		}
		splice(swapLineStart, 0, ...removedBlocks);
	}
}

export function nestSelection() {
	const spliceStart = Math.min(selectPosition, caretPosition);
	const spliceLength = Math.abs(selectPosition - caretPosition);
	selectPosition = spliceStart;
	caretPosition = spliceStart + 1;
	const nestedBlock = blocks.slice(spliceStart, spliceStart + spliceLength);
	return splice(spliceStart, spliceLength, nestedBlock);
}

export function unnestBlock(blockIndex) {
	const block = blocks[blockIndex];
	if (!Array.isArray(block)) {
		return;
	}
	if (caretPosition >= blockIndex) {
		caretPosition += block.length - 1;
	}
	if (selectPosition >= blockIndex) {
		selectPosition += block.length - 1;
	}
	return splice(blockIndex, 1, ...block);
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

function clamp(f, min, max) {
	f = Math.min(f, max);
	f = Math.max(f, min);
	return f;
}

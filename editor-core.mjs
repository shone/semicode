import * as sc from './semicode.mjs';

export const blocks = [];
export let caretPath = [blocks];
export let caretPosition = 0;
export let selectPosition = 0;

export const GROW_ROW = Symbol();
export const SHRINK_ROW = Symbol();
export const GROW_COLUMN = Symbol();

export const functions = new Map();

const whitespaceChars = new Set([' ', '\n', '\t', sc.LINK]);

const onspliceCallbacks = [];
export function onsplice(callback) {
	onspliceCallbacks.push(callback);
}

function applyFunctions() {
	for (let i=0; i<blocks.length; i++) {
		const f = functions.get(blocks[i]);
		if (!f) {
			continue;
		}
		const [lineStart, lineEnd] = getLineIndicesAtPosition(blocks, i);
		const args = blocks.slice(i+1, lineEnd).filter(block => typeof block === 'symbol');
		const targetIndex = blocks.slice(i+1, lineEnd).findIndex(block => Array.isArray(block));
		if (targetIndex === -1) {
			continue;
		}
		const target = blocks[i+1+targetIndex];
		const targetBefore = [...target];
		f(ec.blocks, args, target);
		onspliceCallbacks.forEach(callback => callback(target, 0, targetBefore.length, target, targetBefore));
		i += targetIndex+1;
	}
}

const oncaretmoveCallbacks = [];
export function oncaretmove(callback) {
	oncaretmoveCallbacks.push(callback);
}

export function splice(context, start, deleteCount, ...blocks_) {
	if (deleteCount === 0 && blocks_.length === 0) {
		return;
	}
	const deletedBlocks = context.splice(start, deleteCount, ...blocks_);
	onspliceCallbacks.forEach(callback => callback(context, start, deleteCount, blocks_, deletedBlocks));
	// applyFunctions();
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
	return splice(caretPath.at(-1), spliceStart, spliceLength, ...blocks_);
}

export function moveCaret(position, selection='clear-selection', contextPath=caretPath) {
	if (contextPath !== caretPath) {
		caretPath.splice(0, caretPath.length, ...contextPath);
	}
	caretPosition = clamp(position, 0, contextPath.at(-1).length);
	if (selection === 'clear-selection') {
		selectPosition = caretPosition;
	}
	oncaretmoveCallbacks.forEach(callback => callback(contextPath.at(-1), caretPosition, selectPosition));
}

export function getLineIndicesAtPosition(context, position) {
	let startIndex = position;
	let endIndex = position;
	while (startIndex > 0 && context[startIndex-1] !== '\n') {
		startIndex--;
	}
	while (endIndex < context.length && context[endIndex] !== '\n') {
		endIndex++;
	}
	return [startIndex, endIndex];
}

export function getSelectedLines() {
	let start = Math.min(caretPosition, selectPosition);
	let end = Math.max(caretPosition, selectPosition);
	const caretContext = caretPath.at(-1);
	while (start > 0 && caretContext[start-1] !== '\n') {
		start--;
	}
	while (end < caretContext.length && caretContext[end] !== '\n') {
		end++;
	}
	return [start, end];
}

export function moveCaretLineStart(selection='clear-selection') {
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPath.at(-1), caretPosition);
	moveCaret(lineStart, selection);
}
export function moveCaretLineEnd(selection='clear-selection') {
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretPath.at(-1), caretPosition);
	moveCaret(lineEnd, selection);
}

export function moveCaretWord(direction='forwards', selection='clear-selection') {
	let i = caretPosition;
	const caretContext = caretPath.at(-1);
	if (direction === 'forwards') {
		// Skip non-whitespace
		while (i < caretContext.length && !whitespaceChars.has(caretContext[i])) {
			i++;
			if (typeof caretContext[i] !== 'string') break;
		}
		// Skip whitespace
		while (i < caretContext.length && whitespaceChars.has(caretContext[i])) i++;
	} else if (direction === 'backwards') {
		// Skip preceding whitespace
		while (i > 0 && whitespaceChars.has(caretContext[i-1])) i--;
		// Find preceding non-whitespace
		while (i > 0 && !whitespaceChars.has(caretContext[i-1])) {
			i--;
			if (typeof caretContext[i] !== 'string') break;
		}
	}
	moveCaret(i, selection);
}

export function moveCaretLine(direction='down', selection='clear-selection') {
	const caretContext = caretPath.at(-1);
	const [currentLineStart, currentLineEnd] = getLineIndicesAtPosition(caretContext, caretPosition);
	if (direction === 'up' && currentLineStart === 0) {
		moveCaret(0, selection);
		return;
	}
	if (direction === 'down' && currentLineEnd === caretContext.length) {
		moveCaret(caretContext.length, selection);
		return;
	}
	const caretX = caretPosition - currentLineStart;
	const targetLinePosition = (direction==='down') ? (currentLineEnd+1) : (currentLineStart-1);
	const [targetLineStart, targetLineEnd] = getLineIndicesAtPosition(caretContext, targetLinePosition);
	moveCaret(Math.min(targetLineStart + caretX, targetLineEnd), selection);
}

export function moveCaretAcrossEmbed(direction='forwards') {
	if (direction === 'forwards') {
		if (Array.isArray(caretPath.at(-1)[caretPosition])) {
			caretPath.push(caretPath.at(-1)[caretPosition]);
			caretPosition = 0;
		} else if (caretPosition === caretPath.at(-1).length && caretPath.length > 1) {
			caretPosition = caretPath.at(-2).indexOf(caretPath.at(-1)) + 1;
			caretPath.pop();
		} else if (caretPosition < caretPath.at(-1).length) {
			caretPosition++;
		}
	} else if (direction === 'backwards') {
		if (Array.isArray(caretPath.at(-1)[caretPosition-1])) {
			caretPath.push(caretPath.at(-1)[caretPosition-1]);
			caretPosition = caretPath.at(-1).length;
		} else if (caretPosition === 0 && caretPath.length > 1) {
			caretPosition = caretPath.at(-2).indexOf(caretPath.at(-1));
			caretPath.pop();
		} else if (caretPosition > 0) {
			caretPosition--;
		}
	} else if (direction === 'up') {
		if (caretPath.length > 1) {
			caretPosition = caretPath.at(-2).indexOf(caretPath.at(-1));
			caretPath.pop();
		}
	}
	selectPosition = caretPosition;
	oncaretmoveCallbacks.forEach(callback => callback(caretPath.at(-1), caretPosition, selectPosition));
}

export function deleteAtCaret(direction='backwards') {
	const caretContext = caretPath.at(-1);
	if (caretContext.length === 0) {
		return;
	}

	let spliceStart = Math.min(selectPosition, caretPosition);
	let spliceLength = Math.abs(selectPosition - caretPosition);
	if (spliceLength === 0) {
		if (direction==='backwards' && spliceStart > 0) {
			spliceStart--;
			spliceLength = 1;
		} else if (direction==='forwards' && spliceStart < caretContext.length) {
			spliceLength = 1;
		}
	}

	if (spliceLength === 0) {
		return;
	}

	caretPosition = spliceStart;
	selectPosition = spliceStart;
	return splice(caretContext, spliceStart, spliceLength);
}

export function duplicateLines(direction='down') {
	const caretContext = caretPath.at(-1);
	const [start, end] = getSelectedLines();
	if (start === end) {
		return;
	}
	const lines = caretContext.slice(start, end+1);
	if (direction === 'down') {
		if (end === caretContext.length) {
			lines.unshift('\n');
		}
		caretPosition += lines.length;
		selectPosition += lines.length;
		splice(caretContext, end+1, 0, ...lines);
	} else {
		if (end === caretContext.length) {
			lines.push('\n');
		}
		splice(caretContext, start, 0, ...lines);
	}
}

export function deleteLineAtCaret() {
	const caretContext = caretPath.at(-1);
	if (caretContext.length === 0) {
		return;
	}
	const [lineStart, lineEnd] = getLineIndicesAtPosition(caretContext, caretPosition);
	caretPosition = lineStart;
	selectPosition = lineStart;
	return splice(caretContext, lineStart, (lineEnd-lineStart) + 1);
}

export function moveLines(direction='down') {
	const caretContext = caretPath.at(-1);
	const [start, end] = getSelectedLines();
	if (direction==='down' && end===caretContext.length) {
		return;
	}
	if (direction==='up' && start===0) {
		return;
	}
	const [swapLineStart, swapLineEnd] = getLineIndicesAtPosition(caretContext, direction==='down'?(end+1):(start-1));
	if (direction === 'down') {
		caretPosition += (swapLineEnd-swapLineStart) + 1;
		selectPosition += (swapLineEnd-swapLineStart) + 1;
		const removedBlocks = splice(caretContext, swapLineStart, (swapLineEnd-swapLineStart)+1);
		if (removedBlocks.length===0 || removedBlocks[removedBlocks.length-1]!=='\n') {
			removedBlocks.push('\n');
		}
		splice(caretContext, start, 0, ...removedBlocks);
	} else if (direction === 'up') {
		caretPosition -= (end-start) + 1;
		selectPosition -= (end-start) + 1;
		const removedBlocks = splice(caretContext, start, (end-start)+1);
		if (removedBlocks.length===0 || removedBlocks[removedBlocks.length-1]!=='\n') {
			removedBlocks.push('\n');
		}
		splice(caretContext, swapLineStart, 0, ...removedBlocks);
	}
}

export function nestSelection() {
	const caretContext = caretPath.at(-1);
	const spliceStart = Math.min(selectPosition, caretPosition);
	const spliceLength = Math.abs(selectPosition - caretPosition);
	caretPosition = spliceStart + 1;
	selectPosition = caretPosition;
	const nestedBlock = caretContext.slice(spliceStart, spliceStart + spliceLength);
	return splice(caretContext, spliceStart, spliceLength, nestedBlock);
}

export function unnestBlock(blockIndex) {
	const caretContext = caretPath.at(-1);
	const block = caretContext[blockIndex];
	if (!Array.isArray(block)) {
		return;
	}
	if (caretPosition >= blockIndex) {
		caretPosition += block.length - 1;
	}
	if (selectPosition >= blockIndex) {
		selectPosition += block.length - 1;
	}
	return splice(caretContext, blockIndex, 1, ...block);
}
export function unnest() {
	const caretContext = caretPath.at(-1);
	function getNestedBlock() {
		const selectionStart = Math.min(selectPosition, caretPosition);
		const selectionEnd = Math.max(selectPosition, caretPosition);
		for (let i=selectionStart; i<selectionEnd; i++) {
			if (Array.isArray(caretContext[i])) {
				return i;
			}
		}
		return null;
	}
	const blockIndex = getNestedBlock();
	if (blockIndex === null) {
		return;
		}
	unnestBlock(blockIndex);
}

export function selectAll() {
	const caretContext = caretPath.at(-1);
	if (caretContext.length === 0) {
		return;
	}
	caretPosition = caretContext.length;
	selectPosition = 0;
	oncaretmoveCallbacks.forEach(callback => callback(caretContext, caretPosition, selectPosition));
}

export function deselect() {
	if (selectPosition !== caretPosition) {
		selectPosition = caretPosition;
		oncaretmoveCallbacks.forEach(callback => callback(caretPosition, selectPosition));
	}
}

export function selectWordAtPosition(position, contextPath=caretPath) {
	if (contextPath !== caretPath) {
		caretPath.splice(0, caretPath.length, ...contextPath);
	}
	const context = contextPath.at(-1);
	if (whitespaceChars.has(context[position])) {
		return;
	}
	let wordStart = position;
	while (wordStart > 0 && !whitespaceChars.has(context[wordStart-1])) {
		wordStart--;
	}
	let wordEnd = position;
	while (wordEnd < context.length && !whitespaceChars.has(context[wordEnd])) {
		wordEnd++;
	}
	selectPosition = wordStart;
	caretPosition = wordEnd;
	oncaretmoveCallbacks.forEach(callback => callback(context, caretPosition, selectPosition));
}

function clamp(f, min, max) {
	f = Math.min(f, max);
	f = Math.max(f, min);
	return f;
}

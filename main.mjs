import * as sc from './semicode.mjs';
import * as ec from './editor-core.mjs';
import './editor-html.mjs';

window.sc = sc;
window.ec = ec;

fetch('semicode.txt').then(async response => {
	const semicode = await response.text();
	ec.insertAtCaret(sc.toArray(semicode));
});

const keyActionMap = {
	CtrlSpace:           () => ec.insertAtCaret([Symbol()]),
	CtrlBackslash:       () => ec.insertAtCaret([sc.LINK]),
	CtrlSingleQuote:     () => ec.insertAtCaret([sc.LABEL]),
	ArrowRight:          () => ec.moveCaret(ec.caretPosition+1),
	ArrowLeft:           () => ec.moveCaret(ec.caretPosition-1),
	CtrlArrowRight:      () => ec.moveCaretWord('forwards'),
	CtrlArrowLeft:       () => ec.moveCaretWord('backwards'),
	CtrlShiftArrowRight: () => ec.moveCaretWord('forwards', 'keep-selection'),
	CtrlShiftArrowLeft:  () => ec.moveCaretWord('backwards', 'keep-selection'),
	ArrowUp:             () => ec.moveCaretLine('up'),
	ArrowDown:           () => ec.moveCaretLine('down'),
	ShiftArrowUp:        () => ec.moveCaretLine('up', 'keep-selection'),
	ShiftArrowDown:      () => ec.moveCaretLine('down', 'keep-selection'),
	CtrlAltArrowUp:      () => ec.duplicateLines('up'),
	CtrlAltArrowDown:    () => ec.duplicateLines('down'),
	ShiftArrowRight:     () => ec.moveCaret(ec.caretPosition+1, 'keep-selection'),
	ShiftArrowLeft:      () => ec.moveCaret(ec.caretPosition-1, 'keep-selection'),
	CtrlShiftArrowUp:    () => ec.moveLines('up'),
	CtrlShiftArrowDown:  () => ec.moveLines('down'),
	Home:                () => ec.moveCaretLineStart(),
	End:                 () => ec.moveCaretLineEnd(),
	ShiftHome:           () => ec.moveCaretLineStart('keep-selection'),
	ShiftEnd:            () => ec.moveCaretLineEnd('keep-selection'),
	CtrlHome:            () => ec.moveCaret(0),
	CtrlEnd:             () => ec.moveCaret(ec.blocks.length),
	CtrlShiftHome:       () => ec.moveCaret(0, 'keep-selection'),
	CtrlShiftEnd:        () => ec.moveCaret(ec.blocks.length, 'keep-selection'),
	ShiftEnter:          () => ec.nestSelection(),
	CtrlShiftEnter:      () => ec.unnest(),
	Backspace:           () => ec.deleteAtCaret('backwards'),
	Delete:              () => ec.deleteAtCaret('forwards'),
	ShiftDelete:         () => ec.deleteLineAtCaret(),
	Enter:               () => ec.insertAtCaret(['\n']),
	Ctrla:               () => ec.selectAll(),
	Ctrlc:               () => copy(),
	Ctrlx:               () => cut(),
	Tab:                 () => ec.insertAtCaret(['\t']),
	Escape:              () => ec.deselect(),
	Ctrl1:               () => ec.insertAtCaret([ec.GROW_ROW]),
	Ctrl2:               () => ec.insertAtCaret([ec.GROW_COLUMN]),
}

window.onkeydown = event => {
	const keyAliases = {
		' ': 'Space',
		"'": 'SingleQuote',
		"\\": 'Backslash',
	}
	const keyCombo = (
		(event.ctrlKey   ? 'Ctrl'  : '') +
		(event.shiftKey  ? 'Shift' : '') +
		(event.altKey    ? 'Alt'   : '') +
		(event.metaKey   ? 'Meta'  : '') +
		(keyAliases[event.key] || event.key)
	);
	let action = keyActionMap[keyCombo];
	if (!action && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
		action = () => ec.insertAtCaret([event.key]);
	}
	if (action) {
		event.preventDefault();
		action();
	}
}

document.body.onpaste = async event => {
	const stringItems = [...event.clipboardData.items].filter(item => item.kind === 'string');
	const strings = await Promise.all(stringItems.map(item => new Promise(resolve => item.getAsString(resolve))));
	const pastedBlocks = sc.toArray(strings.join(''));
	ec.insertAtCaret(pastedBlocks);
}

function copy() {
	const startIndex = Math.min(ec.caretPosition, ec.selectPosition);
	const endIndex = Math.max(ec.caretPosition, ec.selectPosition);
	const semicode = sc.fromArray(ec.blocks.slice(startIndex, endIndex));
	navigator.clipboard.writeText(semicode);
}

function cut() {
	if (ec.selectPosition === ec.caretPosition) {
		return;
	}
	const deletedBlocks = ec.deleteAtCaret();
	const semicode = sc.fromArray(deletedBlocks);
	navigator.clipboard.writeText(semicode);
}

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
	CtrlSingleQuote:     () => ec.insertAtCaret([ec.LABEL]),
	ArrowRight:          () => ec.moveCaret(ec.caretPosition+1),
	ArrowLeft:           () => ec.moveCaret(ec.caretPosition-1),
	CtrlArrowRight:      () => ec.moveCaretWord(true),
	CtrlArrowLeft:       () => ec.moveCaretWord(false),
	CtrlShiftArrowRight: () => ec.moveCaretWord(true, true),
	CtrlShiftArrowLeft:  () => ec.moveCaretWord(false, true),
	ArrowUp:             () => ec.moveCaretLine('up'),
	ArrowDown:           () => ec.moveCaretLine('down'),
	ShiftArrowUp:        () => ec.moveCaretLine('up', true),
	ShiftArrowDown:      () => ec.moveCaretLine('down', true),
	ShiftArrowRight:     () => ec.moveCaret(ec.caretPosition+1,true),
	ShiftArrowLeft:      () => ec.moveCaret(ec.caretPosition-1,true),
	Home:                () => ec.moveCaretLineStart(),
	End:                 () => ec.moveCaretLineEnd(),
	ShiftHome:           () => ec.moveCaretLineStart(true),
	ShiftEnd:            () => ec.moveCaretLineEnd(true),
	CtrlHome:            () => ec.moveCaret(0),
	CtrlEnd:             () => ec.moveCaret(ec.blocks.length),
	ShiftEnter:          () => ec.nestSelection(),
	CtrlShiftEnter:      () => ec.unnest(),
	Backspace:           () => ec.deleteAtCaret(true),
	Delete:              () => ec.deleteAtCaret(false),
	Enter:               () => ec.insertAtCaret(['\n']),
	Ctrla:               () => ec.selectAll(),
	Ctrlc:               () => copy(),
	Tab:                 () => ec.insertAtCaret(['\t']),
	Escape:              () => ec.deselect(),
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
		// updateLabels();
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

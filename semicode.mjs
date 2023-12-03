export const LINK = '\uEEEE';
export const EMBED = '\uEEEF';
export const EMBED_BYTES = '\uEEEA';

const symbolToBytesMap = new Map(); // TODO: use WeakMap
export function symbolToBytes(symbol) {
	let bytes = symbolToBytesMap.get(symbol);
	if (!bytes) {
		bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		symbolToBytesMap.set(symbol, bytes);
	}
	return bytes;
}
export function bytesToSymbol(bytes) {
	for (const [symbol, bytes_] of symbolToBytesMap) {
		if (compareArrayBuffers(bytes, bytes_)) {
			return symbol;
		}
	}
	const symbol = Symbol();
	symbolToBytesMap.set(symbol, bytes);
	return symbol;
}

export function toArray(semicode/*: string*/) {
	const blocks = [];
	for (let i=0; i<semicode.length; i++) {
		if (semicode[i] === EMBED) {
			i++;
			const embedLengthIndex = i;
			while (semicode[i] !== ':') {
				i++;
			}
			const embedLength = parseInt(semicode.slice(embedLengthIndex, i));
			const embeddedString = semicode.slice(i+1, i+1+embedLength);
			blocks.push(toArray(embeddedString));
			i += embedLength;
		} else if (semicode[i] === EMBED_BYTES) {
			i++;
			const embedLengthIndex = i;
			while (semicode[i] !== ':') {
				i++;
			}
			const embedLength = parseInt(semicode.slice(embedLengthIndex, i)) * 2;
			const embeddedString = semicode.slice(i+1, i+1+embedLength);
			const bytes = hexStringToBytes(embeddedString);
			const symbol = bytesToSymbol(bytes);
			blocks.push(symbol);
			i += embedLength;
		} else {
			blocks.push(semicode[i]);
		}
	}
	return blocks;
}
export function fromArray(array) {
	return array.flatMap(block => {
		if (typeof block === 'string') {
			return block;
		}
		if (Array.isArray(block)) {
			return `${EMBED}${block.length}:${fromArray(block)}`;
		}
		if (typeof block === 'symbol') {
			const bytes = symbolToBytesMap.get(block);
			return `${EMBED_BYTES}${bytes.length}:${[...bytes].map(byteToHexString).join('')}`;
		}
	}).join('');
}

function isWordSeparator(char) {
	if (typeof char !== 'string') {
		return true;
	}
	switch (char) {
		case ' ':
		case '\n':
		case '\t':
		case LINK:
			return true;
	}
	return false;
}

export function* arrayToWords(array) {
	for (let i=0, wordStart=0; i<=array.length; i++) {
		if (i === array.length || isWordSeparator(array[i])) {
			if (wordStart < i) {
				if ((i - wordStart) === 1) {
					yield array[wordStart];
				} else {
					yield array.slice(wordStart, i).join('');
				}
			}
			if (typeof array[i] === 'symbol' || array[i] === LINK) {
				yield array[i];
			}
			wordStart = i+1;
		}
	}
}

export function* arrayToTriples(array) {
	const words = arrayToWords(array);
	let word = words.next().value;
	while (word) {
		// FROM
		if (word === LINK) {
			word = words.next().value;
			continue;
		}
		const from = word;

		// LINK
		word = words.next().value;
		if (word !== LINK) continue;

		// VIA
		word = words.next().value;
		if (!word || word === LINK) continue;
		const via = word;

		// LINK
		word = words.next().value;
		if (word !== LINK) continue;

		// TO
		word = words.next().value;
		if (!word || word === LINK) continue;
		const to = word;

		yield [from, via, to];
	}
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

function byteToHexString(byte) {
	return ('0' + (byte & 0xFF).toString(16)).slice(-2);
}
function hexStringToBytes(string) {
	const byteCount = string.length / 2;
	const bytes = new Uint8Array(byteCount);
	for (let i=0; i<byteCount; i++) {
		bytes[i] = parseInt(string.substr(i*2, 2), 16);
	}
	return bytes;
}

function toHexString(byteArray) {
	return Array.from(byteArray, byteToHexString).join('');
}

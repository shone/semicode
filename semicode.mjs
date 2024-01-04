export const LINK = '\uEEEE';
export const EMBED = '\uEEEF';
export const EMBED_BYTES = '\uEEEA';
export const LABEL = '\uE001';

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
export function hexStringToSymbol(hexString) {
	return bytesToSymbol(hexStringToBytes(hexString));
}

export function* toArray(semicode/*: string*/) {
	for (let i=0; i<semicode.length; i++) {
		const char = semicode[i];
		if (char === EMBED || char === EMBED_BYTES) {
			i++;
			const embedLengthIndex = i;
			while (semicode[i] !== ':') {
				i++;
				if (i >= semicode.length) {
					throw `Error while converting semicode to array: reached end before corresponding embed length semicolon found.`;
				}
			}
			const embedLengthString = semicode.slice(embedLengthIndex, i);
			const embedLength = parseInt(embedLengthString);
			if (isNaN(embedLength)) {
				throw `Error while converting semicode to array: could not parse embed length "${embedLengthString}" as integer.`;
			}
			if (embedLength < 0) {
				throw `Error while converting semicode to array: embed length "${embedLengthString}" is negative.`;
			}
			if (char === EMBED) {
				const embeddedString = semicode.slice(i+1, i+1+embedLength);
				yield [...toArray(embeddedString)];
				i += embedLength;
			} else if (char === EMBED_BYTES) {
				const embeddedString = semicode.slice(i+1, i+1+(embedLength*2));
				const bytes = hexStringToBytes(embeddedString);
				const symbol = bytesToSymbol(bytes);
				yield symbol;
				i += embedLength * 2;
			}
		} else {
			yield char;
		}
	}
}
export function fromArray(array) {
	return array.flatMap((block, index) => {
		if (typeof block === 'string') {
			return block;
		}
		if (Array.isArray(block)) {
			const semicode = fromArray(block);
			return `${EMBED}${semicode.length}:${semicode}`;
		}
		if (typeof block === 'symbol') {
			const bytes = symbolToBytes(block);
			return `${EMBED_BYTES}${bytes.length}:${[...bytes].map(byteToHexString).join('')}`;
		}
		throw `Can't convert array to semicode: block ${index+1} has unsupported type '${typeof block}'`;
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
		case LABEL:
			return true;
	}
	return false;
}

export function* arrayToLines(array) {
	for (let i=0, lineStart=0; i<=array.length; i++) {
		if (array[i] === '\n' || i === array.length) {
			yield {start: lineStart, end: i};
			lineStart = i+1;
		}
	}
}

export function* arrayToWords(array) {
	for (let i=0, wordStart=0; i<=array.length; i++) {
		if (i < array.length && Array.isArray(array[i])) {
			yield* arrayToWords(array[i]);
			wordStart = i+1;
		} else if (i === array.length || isWordSeparator(array[i])) {
			if (wordStart < i) {
				if ((i - wordStart) === 1) {
					yield array[wordStart];
				} else {
					yield array.slice(wordStart, i).join('');
				}
			}
			if (typeof array[i] === 'symbol' || array[i] === LINK || array[i] === LABEL) {
				yield array[i];
			}
			wordStart = i+1;
		}
	}
}

export function* arrayToTriples(array) {
	for (const line of arrayToLines(array)) {
		const words = arrayToWords(array.slice(line.start, line.end));
		let word = words.next().value;
		while (word) {
			if (word !== LINK) {
				word = words.next().value;
				continue;
			}

			word = words.next().value;
			if (!word || word === LINK) continue;
			const from = word;

			word = words.next().value;
			if (!word || word === LINK) continue;
			const via = word;

			word = words.next().value;
			if (!word || word === LINK) continue;
			const to = word;

			yield [from, via, to];
		}
	}
}

export function* deduplicateTriples(triples) {
	const symbolToIdMap = new Map();
	let idCounter = 0;
	function getSymbolId(symbol) {
		let id = symbolToIdMap.get(symbol);
		if (id === undefined) {
			id = idCounter++;
			symbolToIdMap.set(symbol, id);
		}
		return id;
	}
	const triplesAlreadySeen = new Set();
	for (const triple of triples) {
		const tripleSetEntry = triple.map(getSymbolId).join('-');
		if (!triplesAlreadySeen.has(tripleSetEntry)) {
			yield triple;
			triplesAlreadySeen.add(tripleSetEntry);
		}
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
export function hexStringToBytes(string) {
	const byteCount = string.length / 2;
	const bytes = new Uint8Array(byteCount);
	for (let i=0; i<byteCount; i++) {
		bytes[i] = parseInt(string.substr(i*2, 2), 16);
	}
	return bytes;
}

export function toHexString(byteArray) {
	return Array.from(byteArray, byteToHexString).join('');
}

export function makeRandomHexString() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return toHexString(bytes);
}

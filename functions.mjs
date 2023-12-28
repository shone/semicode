import * as sc from './semicode.mjs';
import * as ec from './editor-core.mjs';

export const TRIPLES = sc.hexStringToSymbol('2832e221c14e355ae48e6b55c11412a5');
export const LIST    = sc.hexStringToSymbol('988eadf6e2526898c25ed28ab4993e6a');

ec.functions.set(TRIPLES, function triples(blocks, args, target) {
	const triples = [...sc.deduplicateTriples(sc.arrayToTriples(blocks))];
	const blocks_ = triples.map((triple, index) => index < triples.length-1 ? [...triple, '\n'] : triple).flat();
	target.splice(0, target.length, ...blocks_);
});

ec.functions.set(LIST, function list(blocks, args, target) {
	if (args.length !== 2) {
		return;
	}
	const triples = [...sc.deduplicateTriples(sc.arrayToTriples(blocks))];
	const [source, via] = args;
	let item = source;
	const list = [];
	const visited = new Set();
	while (item !== null && !visited.has(item)) {
		list.push(item);
		visited.add(item);
		const nextItemTriple = triples.find(triple => triple[0] === item && triple[1] === via);
		item = nextItemTriple ? nextItemTriple[2] : null;
	}
	target.splice(0, target.length, ...list);
});

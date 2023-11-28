# Semicode - semantic unicode

An experiment to extend unicode with the ability to define semantic webs.

Semicode is a superset of unicode. It introduces two new features:

- The 'link' control character, which can be used to link three words together into a triple.
- The 'embed' control character, which defines a variable-length block of bytes, which may itself be semicode.

Any valid unicode document is a valid semicode document.

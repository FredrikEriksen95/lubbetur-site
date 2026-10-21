# Setter src/arcade (data.js + arcade.js + arcade.css) inn i src/lubbetur.html
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
s = open(R + 'src/arcade/arcade.js').read(); c = open(R + 'src/arcade/arcade.css').read()
a = open(R + 'src/arcade/data.js').read() + s
h = open(R + 'src/lubbetur.html').read()
i = h.index('// Spillhallen – oppgavebibliotek'); j = h.index('\n</script>\n<script>\n', i)
h = h[:i] + a.rstrip('\n') + h[j:]
ci = h.index('/* ---------- Spillhallen ---------- */'); cj = h.index('\n</style>', ci)
h = h[:ci] + c.rstrip('\n') + h[cj:]
open(R + 'src/lubbetur.html', 'w').write(h); print('bundle ok', len(h))

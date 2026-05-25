# Smart DRC suggestions 0.1

Ovaj patch dodaje pametne predloge rešenja za DRC greške.

## Šta radi

Kada DRC prijavi problem, panel sada prikazuje:

- naziv problema,
- objašnjenje,
- predlog rešenja,
- nivo sigurnosti:
  - Safe suggestion,
  - Review before applying,
  - Manual fix required,
- korake za ručnu ispravku.

## Namerno nije dodato potpuno automatsko popravljanje

Automatsko brisanje/rerutiranje može lako da pokvari ploču. Zato je ovo prva stabilna faza: softver predlaže ispravku, a korisnik bira šta radi.

Sledeća faza može dodati sigurnije quick-fix akcije, npr:

- Select target object,
- Delete invalid trace,
- Increase trace width to rule,
- Increase via drill/diameter,
- Move component inside board.

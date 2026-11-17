// Editable transportation / crane charges (Room + Toilet quotations).
//
// The template notes (Room: note 5 = Transportation, note 6 = Erection
// crane; Toilet: note 5 = Transport Charges, note 6 = Crane Charges) are
// the source of truth. Their verbatim text is parsed to recover the prefix,
// sample amount and suffix, so an edited amount always renders in the
// template's own wording and styling. Empty input falls back to the original
// template note (verbatim), keeping the template's wording when untouched.

// Notes exist in three shapes: a run array (Room), a single run object
// (Toilet) or a plain string (tanks). Normalize to a run array.
function toRuns(note) {
  if (Array.isArray(note)) return note;
  if (note && typeof note === 'object' && typeof note.t === 'string') return [note];
  return [{ t: String(note) }];
}

// Index of the first note containing any of the keywords (a single string
// or an array of alternatives).
function findNoteIndex(template, keyword) {
  const keys = (Array.isArray(keyword) ? keyword : [keyword]).map((k) =>
    String(k).toLowerCase()
  );
  const notes = template?.notes || [];
  return notes.findIndex((note) => {
    const text = toRuns(note)
      .map((r) => r.t)
      .join('')
      .toLowerCase();
    return keys.some((k) => text.includes(k));
  });
}

// Returns { index, style, pre, valSuf, def, b, c } or null when the template
// has no such note. Shapes found in the source Excels:
//   - one bold-red run:            "Transportation:Rs.12000/-"          (Room)
//   - plain prefix + bold value:   "Transportation: " + "Rs.30000/- (2 lorry)"
//                                  "Transportation  – " + "Client Scope."
//   - one plain run, no amount:    "Transport Charges at client scope." (Toilet)
export function deriveCharge(template, keyword) {
  const index = findNoteIndex(template, keyword);
  if (index < 0) return null;

  const list = toRuns(template.notes[index]);

  if (list.length === 1) {
    const m = list[0].t.match(/^(.*?)Rs\.([\d,]+)(\/-.*)$/);
    if (m) {
      return {
        index,
        style: 'boldRed',
        pre: m[1],
        valSuf: m[3],
        def: m[2],
        b: !!list[0].b,
        c: list[0].c,
      };
    }

    // Toilet-style note without an amount: "Transport Charges at client
    // scope." The " at client scope" clause is what an entered amount
    // replaces, so the note keeps the template's own wording either way.
    const scope = list[0].t.match(/^(.*?)\s+at\s+client\s+scope\.?$/i);
    if (scope) {
      return {
        index,
        style: 'runs',
        pre: `${scope[1].trim()}:`,
        valSuf: '/-',
        def: '',
        b: !!list[0].b,
        c: list[0].c,
      };
    }

    return null;
  }

  const pre = list[0].t || '';
  const value = list[1] || {};
  const m = (value.t || '').match(/^Rs\.(.+?)(\/-.*)$/);
  return {
    index,
    style: 'runs',
    pre,
    valSuf: m ? m[2] : '/-',
    def: m ? m[1] : '',
    b: !!value.b,
    c: value.c,
  };
}

// Runs to display for an edited charge. Returns null when the amount is
// empty, meaning "keep the template's original note verbatim".
export function chargeRuns(charge, amount) {
  const value = String(amount ?? '').trim();
  if (!value || !charge) return null;

  if (charge.style === 'boldRed') {
    return [
      {
        t: `${charge.pre}Rs.${value}${charge.valSuf}`,
        b: charge.b,
        c: charge.c,
      },
    ];
  }

  return [
    { t: charge.pre },
    {
      t: `Rs.${value}${charge.valSuf}`,
      b: charge.b,
      c: charge.c,
    },
  ];
}

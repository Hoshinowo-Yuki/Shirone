import { visit } from 'unist-util-visit';

function isHiragana(char) {
  const code = char.charCodeAt(0);
  return code >= 0x3040 && code <= 0x309f;
}

function isKatakana(char) {
  const code = char.charCodeAt(0);
  return code >= 0x30a0 && code <= 0x30ff;
}

function isKana(char) {
  return isHiragana(char) || isKatakana(char);
}

function isKanji(char) {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9faf) ||
    (code >= 0x3400 && code <= 0x4dbf)
  );
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function parseFurigana(text, reading) {
  // Emphasis dots: [すごい]{*} or [あいう]{*❤}
  if (reading.startsWith('*') || reading.startsWith('＊')) {
    const dot = reading.slice(1) || '・';
    return [...text].map(char => ({
      text: char,
      reading: dot
    }));
  }

  // Literal mode: [食べる]{=たべる}
  if (reading.startsWith('=') || reading.startsWith('＝')) {
    return [{
      text: text,
      reading: reading.slice(1)
    }];
  }

  // Combined mode: [可愛い犬]{か+わいいいぬ} → whole text gets combined reading
  if (reading.includes('+') || reading.includes('＋')) {
    const combinedReading = reading.replaceAll('+', '').replaceAll('＋', '');
    return [{
      text: text,
      reading: combinedReading
    }];
  }

  // Check for separators
  const separatorRegex = /[.．。・|｜/／]/;
  const hasSeparators = separatorRegex.test(reading);

  if (hasSeparators) {
    return parseWithSeparators(text, reading);
  }

  // No separators - simple mode
  return simpleMatch(text, reading);
}

function parseWithSeparators(text, reading) {
  // Split reading by separators
  const readingParts = reading.split(/[.．。・|｜/／]/).filter(p => p.length > 0);
  
  // Find kanji groups in text
  const segments = [];
  let current = '';
  let currentIsKanji = null;

  for (const char of text) {
    const charIsKanji = isKanji(char);
    const charIsKana = isKana(char);

    if (currentIsKanji === null) {
      current = char;
      currentIsKanji = charIsKanji;
    } else if (charIsKanji && currentIsKanji) {
      current += char;
    } else if (charIsKana && !currentIsKanji) {
      current += char;
    } else {
      segments.push({ text: current, isKanji: currentIsKanji });
      current = char;
      currentIsKanji = charIsKanji;
    }
  }
  if (current) {
    segments.push({ text: current, isKanji: currentIsKanji });
  }

  // Match reading parts to kanji segments
  const results = [];
  let readingIndex = 0;

  for (const segment of segments) {
    if (segment.isKanji) {
      // Each kanji character gets a reading part
      for (const char of segment.text) {
        const readingPart = readingParts[readingIndex] || '';
        results.push({ text: char, reading: readingPart || null });
        readingIndex++;
      }
    } else {
      // Kana passes through without reading
      results.push({ text: segment.text, reading: null });
    }
  }

  return results;
}

function simpleMatch(text, reading) {
  // Check if text contains any kanji
  const hasKanji = [...text].some(isKanji);

  if (!hasKanji) {
    // No kanji - apply reading to whole text (e.g., [cat]{ねこ})
    return [{ text, reading }];
  }

  // Simple case: all kanji, apply reading to whole thing
  const allKanji = [...text].every(isKanji);
  if (allKanji) {
    return [{ text, reading }];
  }

  // Mixed kanji and kana - try to match
  return matchMixed(text, reading);
}

function matchMixed(text, reading) {
  const results = [];
  let textIdx = 0;
  let readingIdx = 0;

  while (textIdx < text.length) {
    const char = text[textIdx];

    if (isKana(char)) {
      // Collect consecutive kana
      let kanaRun = '';
      while (textIdx < text.length && isKana(text[textIdx])) {
        kanaRun += text[textIdx];
        textIdx++;
        readingIdx++; // Skip corresponding reading chars
      }
      results.push({ text: kanaRun, reading: null });
    } else if (isKanji(char)) {
      // Collect consecutive kanji
      let kanjiRun = '';
      while (textIdx < text.length && isKanji(text[textIdx])) {
        kanjiRun += text[textIdx];
        textIdx++;
      }

      // Find where the next kana in text appears in reading
      let kanjiReading;
      if (textIdx < text.length && isKana(text[textIdx])) {
        // Look for this kana sequence in reading
        const nextKana = text[textIdx];
        const kanaPos = reading.indexOf(nextKana, readingIdx);
        if (kanaPos > readingIdx) {
          kanjiReading = reading.slice(readingIdx, kanaPos);
          readingIdx = kanaPos;
        } else {
          kanjiReading = reading.slice(readingIdx);
          readingIdx = reading.length;
        }
      } else {
        // No more kana, take rest of reading
        kanjiReading = reading.slice(readingIdx);
        readingIdx = reading.length;
      }

      results.push({ text: kanjiRun, reading: kanjiReading });
    } else {
      // Other characters
      results.push({ text: char, reading: null });
      textIdx++;
    }
  }

  return results;
}

function generateRuby(parts, fallbackParens = '【】') {
  const openParen = fallbackParens[0] || '【';
  const closeParen = fallbackParens[1] || '】';

  return parts.map(({ text, reading }) => {
    if (!reading) {
      return escapeHtml(text);
    }
    return `<ruby>${escapeHtml(text)}<rp>${openParen}</rp><rt>${escapeHtml(reading)}</rt><rp>${closeParen}</rp></ruby>`;
  }).join('');
}

export function remarkFurigana(options = {}) {
  const { fallbackParens = '【】' } = options;

  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null) return;

      const furiganaRegex = /\[([^\]]+)\]\{([^}]+)\}/g;
      const text = node.value;

      if (!furiganaRegex.test(text)) return;

      furiganaRegex.lastIndex = 0;

      const children = [];
      let lastIndex = 0;
      let match;

      while ((match = furiganaRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          children.push({
            type: 'text',
            value: text.slice(lastIndex, match.index)
          });
        }

        const baseText = match[1];
        const reading = match[2];
        const parts = parseFurigana(baseText, reading);
        const rubyHtml = generateRuby(parts, fallbackParens);

        children.push({
          type: 'html',
          value: rubyHtml
        });

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < text.length) {
        children.push({
          type: 'text',
          value: text.slice(lastIndex)
        });
      }

      parent.children.splice(index, 1, ...children);
    });
  };
}

export default remarkFurigana;
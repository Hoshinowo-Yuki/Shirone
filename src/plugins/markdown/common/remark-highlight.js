import { visit } from 'unist-util-visit';

export function remarkHighlight() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null) return;

      const highlightRegex = /==([^=]+)==/g;
      const text = node.value;

      if (!highlightRegex.test(text)) return;

      // Reset regex
      highlightRegex.lastIndex = 0;

      const children = [];
      let lastIndex = 0;
      let match;

      while ((match = highlightRegex.exec(text)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
          children.push({
            type: 'text',
            value: text.slice(lastIndex, match.index)
          });
        }

        // The highlighted text
        children.push({
          type: 'html',
          value: `<mark>${escapeHtml(match[1])}</mark>`
        });

        lastIndex = match.index + match[0].length;
      }

      // Text after last match
      if (lastIndex < text.length) {
        children.push({
          type: 'text',
          value: text.slice(lastIndex)
        });
      }

      // Replace node with children
      parent.children.splice(index, 1, ...children);
    });
  };
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

export default remarkHighlight;


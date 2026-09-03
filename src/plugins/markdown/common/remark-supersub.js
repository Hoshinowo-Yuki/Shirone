import { visit } from 'unist-util-visit';

export function remarkSupersub() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null) return;

      // Match ^superscript^ and ~subscript~
      const regex = /(\^([^\^]+)\^)|(~([^~]+)~)/g;
      const text = node.value;

      if (!regex.test(text)) return;

      // Reset regex
      regex.lastIndex = 0;

      const children = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
          children.push({
            type: 'text',
            value: text.slice(lastIndex, match.index)
          });
        }

        if (match[2]) {
          // Superscript: ^text^
          children.push({
            type: 'html',
            value: `<sup>${escapeHtml(match[2])}</sup>`
          });
        } else if (match[4]) {
          // Subscript: ~text~
          children.push({
            type: 'html',
            value: `<sub>${escapeHtml(match[4])}</sub>`
          });
        }

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

export default remarkSupersub;
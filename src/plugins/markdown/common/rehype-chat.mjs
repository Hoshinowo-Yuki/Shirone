/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * 解析聊天消息的 header 行
 * 格式: [username|timestamp] 或 [username|timestamp|right] 或 [username|timestamp|position|replyTo]
 */
function parseChatHeader(text) {
  const match = text.match(/^\[([^|]+)\|([^|\]]+)(?:\|(\w+))?(?:\|([^\]]+))?\]/);
  if (!match) return null;
  
  return {
    username: match[1].trim(),
    timestamp: match[2].trim(),
    position: (match[3] && match[3].trim()) || 'left',
    replyTo: (match[4] && match[4].trim()) || null
  };
}

/**
 * 從 children 中提取文本內容
 */
function extractText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if (node.children) {
    return node.children.map(extractText).join('');
  }
  return '';
}

/**
 * 處理 chat directive
 */
export function rehypeChat(properties, children) {
  if (!Array.isArray(children) || children.length === 0) {
    return h("div", { class: "chat-container chat-empty" }, "No messages");
  }

  const messages = [];
  let currentMessage = null;

  for (const child of children) {
    // 跳過空白節點
    if (child.type === 'text' && !child.value.trim()) continue;
    
    // 處理段落 <p>
    if (child.tagName === 'p') {
      const text = extractText(child);
      const header = parseChatHeader(text);
      
      if (header) {
        // 這是一個新消息的開始
        if (currentMessage) {
          messages.push(currentMessage);
        }
        
        // 提取 header 後面的內容作為消息文本
        const messageText = text.replace(/^\[[^\]]+\]\s*/, '').trim();
        
        currentMessage = {
          ...header,
          content: messageText ? [h("p", {}, messageText)] : []
        };
      } else if (currentMessage) {
        // 這是當前消息的延續內容
        currentMessage.content.push(child);
      }
    } 
    // 處理 blockquote (引用)
    else if (child.tagName === 'blockquote' && currentMessage) {
      currentMessage.content.push(child);
    }
    // 其他元素也添加到當前消息
    else if (currentMessage) {
      currentMessage.content.push(child);
    }
  }

  // 添加最後一個消息
  if (currentMessage) {
    messages.push(currentMessage);
  }

  if (messages.length === 0) {
    return h("div", { class: "chat-container chat-empty" }, "No valid messages found");
  }

  // 生成消息元素 - 使用 CSS 中定義的 class 名稱
  const messageElements = messages.map((msg, index) => {
    return h("div", { 
      class: `chat-message chat-${msg.position}`,
      "data-index": index
    }, [
      h("div", { class: "chat-bubble" }, [
        h("div", { class: "chat-header" }, [
          h("span", { class: "chat-username" }, msg.username),
          h("span", { class: "chat-timestamp" }, msg.timestamp)
        ]),
        h("div", { class: "chat-content" }, [
          ...(msg.replyTo ? [
            h("span", { class: "chat-reply-to" }, [
              h("iconify-icon", { icon: "fa6-solid:reply" }),
              ` @${msg.replyTo}`
            ])
          ] : []),
          ...msg.content
        ])
      ])
    ]);
  });

  return h("div", { class: "chat-container" }, messageElements);
}

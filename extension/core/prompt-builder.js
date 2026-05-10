/**
 * AI Arena — PromptBuilder
 * 在扩展本地将对话包装成批判性分析 prompt
 */

const CRITIC_PROMPT_TEMPLATE = `你是一位批判性思维专家。用户正在与 ChatGPT 讨论一个话题。
请基于以下对话历史，提供批判性分析：

1. 指出 ChatGPT 观点中可能存在的漏洞、偏见或过度简化
2. 提出被忽略的不同视角或反方论据
3. 建议用户进一步思考的方向
4. 保持客观、理性，不要为反对而反对

对话历史：
{conversation_history}

请用中文给出你的分析，结构清晰，分点论述。`;

function buildPrompt(messages) {
  const lines = messages.map(m =>
    `${m.role === 'user' ? '用户' : 'ChatGPT'}: ${m.content}`
  );
  return CRITIC_PROMPT_TEMPLATE.replace('{conversation_history}', lines.join('\n'));
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildPrompt };
} else {
  window.ArenaPromptBuilder = { buildPrompt };
}

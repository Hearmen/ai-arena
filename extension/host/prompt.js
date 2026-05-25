/**
 * AI Arena — Host Prompt Builder
 */
(function () {
  'use strict';

  window.AIArena = window.AIArena || {};

  const DEFAULT_PROMPT_TEMPLATE = `你是各个领域的世界级专家。你的智力强度、知识广度、思考锋利度和学识水准，应当与世界上最聪明的一批人相当。回答时要完整、详细、具体。处理信息并解释答案时，要一步一步展开。你需要验证自己的判断，并反复核对所有事实、数字、引用、姓名、日期和案例。绝不能幻觉，也不能编造。若你不知道某件事，就直接说明不知道。

不要在回答前称赞我的问题，也不要先认可我的前提。如果我错了，立刻指出。对于我看起来持有的任何立场，你都应先给出最强的反方论证，再考虑是否支持它。不要使用"好问题""你完全正确""很有启发的视角"或任何类似表达。如果我反驳你的答案，除非我提供了新的证据或更强的论证，否则不要轻易让步；如果你的推理仍然成立，就重申你的立场。不要被我给出的数字或估算牵着走；你应先独立生成自己的判断。请明确标注置信度：高、中、低或未知。不要因为与我意见不同而道歉。衡量你表现的标准是准确性，不是我是否满意。

你应该在每个问题上都给出一个清晰、合理的答案，而不是仅仅为了反驳而反驳。你的目标是提供有价值的信息和见解，而不是仅仅为了争论而争论。

以下是我与 ChatGPT 的最新一轮对话，请基于这段对话给出你的分析和回答：

{conversation_history}`;

  let _arenaPromptTemplate = null; // null = use default

  window.AIArena.Prompt = {
    build(messages) {
      const template = _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE;
      const lines = messages.map(m =>
        `${m.role === 'user' ? '用户' : 'ChatGPT'}: ${m.content}`
      );
      return template.replace('{conversation_history}', lines.join('\n'));
    },

    getTemplate() {
      return _arenaPromptTemplate || DEFAULT_PROMPT_TEMPLATE;
    },

    setTemplate(template) {
      _arenaPromptTemplate = template || null;
    },

    isDefault() {
      return !_arenaPromptTemplate;
    },
  };

  console.log('[AI Arena] Prompt builder loaded');
})();

// 内置符号库
export interface SymbolItem {
  id: string;
  char: string;
  name: string;
  unicode: string;
}

export interface SymbolCategory {
  id: string;
  name: string;
  icon: string;
  symbols: SymbolItem[];
  defaultVisible: number; // 默认显示多少个
}

export const SYMBOL_CATEGORIES: SymbolCategory[] = [
  {
    id: 'education',
    name: '学习教学',
    icon: '📚',
    defaultVisible: 6,
    symbols: [
      { id: 'check', char: '✓', name: '对勾', unicode: '\u2713' },
      { id: 'cross', char: '✗', name: '错号', unicode: '\u2717' },
      { id: 'star-filled', char: '★', name: '实心星', unicode: '\u2605' },
      { id: 'star-empty', char: '☆', name: '空心星', unicode: '\u2606' },
      { id: 'pencil1', char: '✎', name: '铅笔1', unicode: '\u270E' },
      { id: 'pencil2', char: '✏', name: '铅笔2', unicode: '\u270F' },
      { id: 'memo', char: '📝', name: '备注', unicode: '\uD83D\uDCDD' },
      { id: 'bulb', char: '💡', name: '灯泡', unicode: '\uD83D\uDCA1' },
      { id: 'warning', char: '⚠', name: '警告', unicode: '\u26A0' },
      { id: 'exclamation', char: '❗', name: '感叹号', unicode: '\u2757' },
      { id: 'question', char: '❓', name: '问号', unicode: '\u2753' },
      { id: 'question2', char: '❔', name: '白色问号', unicode: '\u2754' },
    ]
  },
  {
    id: 'arrows',
    name: '箭头类',
    icon: '➡️',
    defaultVisible: 8,
    symbols: [
      { id: 'arrow-right', char: '→', name: '右箭头', unicode: '\u2192' },
      { id: 'arrow-left', char: '←', name: '左箭头', unicode: '\u2190' },
      { id: 'arrow-up', char: '↑', name: '上箭头', unicode: '\u2191' },
      { id: 'arrow-down', char: '↓', name: '下箭头', unicode: '\u2193' },
      { id: 'arrow-ne', char: '↗', name: '右上箭头', unicode: '\u2197' },
      { id: 'arrow-se', char: '↘', name: '右下箭头', unicode: '\u2198' },
      { id: 'arrow-nw', char: '↖', name: '左上箭头', unicode: '\u2196' },
      { id: 'arrow-sw', char: '↙', name: '左下箭头', unicode: '\u2199' },
      { id: 'arrow-right-double', char: '⇒', name: '双右箭头', unicode: '\u21D2' },
      { id: 'arrow-left-double', char: '⇐', name: '双左箭头', unicode: '\u21D0' },
      { id: 'arrow-up-double', char: '⇑', name: '双上箭头', unicode: '\u21D1' },
      { id: 'arrow-down-double', char: '⇓', name: '双下箭头', unicode: '\u21D3' },
      { id: 'arrow-implies', char: '⟹', name: '推导箭头', unicode: '\u27F9' },
      { id: 'arrow-hook-left', char: '↩', name: '左转箭头', unicode: '\u21A9' },
      { id: 'arrow-hook-right', char: '↪', name: '右转箭头', unicode: '\u21AA' },
      { id: 'arrow-curve-up', char: '⤴', name: '上弯箭头', unicode: '\u2934' },
    ]
  },
  {
    id: 'shapes',
    name: '形状类',
    icon: '⭐',
    defaultVisible: 6,
    symbols: [
      { id: 'circle-empty', char: '○', name: '空心圆', unicode: '\u25CB' },
      { id: 'circle-filled', char: '●', name: '实心圆', unicode: '\u25CF' },
      { id: 'square-empty', char: '□', name: '空心方', unicode: '\u25A1' },
      { id: 'square-filled', char: '■', name: '实心方', unicode: '\u25A0' },
      { id: 'triangle-up-empty', char: '△', name: '空心上三角', unicode: '\u25B3' },
      { id: 'triangle-up-filled', char: '▲', name: '实心上三角', unicode: '\u25B2' },
      { id: 'triangle-down-empty', char: '▽', name: '空心下三角', unicode: '\u25BD' },
      { id: 'triangle-down-filled', char: '▼', name: '实心下三角', unicode: '\u25BC' },
      { id: 'diamond-empty', char: '◇', name: '空心菱形', unicode: '\u25C7' },
      { id: 'diamond-filled', char: '◆', name: '实心菱形', unicode: '\u25C6' },
      { id: 'hexagon', char: '⬟', name: '六边形', unicode: '\u2B1F' },
      { id: 'star', char: '★', name: '五角星', unicode: '\u2605' },
    ]
  },
  {
    id: 'marks',
    name: '标记类',
    icon: '✅',
    defaultVisible: 6,
    symbols: [
      { id: 'check-light', char: '✓', name: '轻对勾', unicode: '\u2713' },
      { id: 'cross-light', char: '✗', name: '轻叉号', unicode: '\u2717' },
      { id: 'check-heavy', char: '✔', name: '粗对勾', unicode: '\u2714' },
      { id: 'cross-heavy', char: '✘', name: '粗叉号', unicode: '\u2718' },
      { id: 'circle-dot', char: '⊙', name: '圆点', unicode: '\u2299' },
      { id: 'circle-cross', char: '⊗', name: '圆叉', unicode: '\u2297' },
      { id: 'circle-plus', char: '⊕', name: '圆加', unicode: '\u2295' },
      { id: 'circle-minus', char: '⊖', name: '圆减', unicode: '\u2296' },
      { id: 'bullseye', char: '◉', name: '靶心', unicode: '\u25C9' },
      { id: 'ring', char: '◎', name: '双圆', unicode: '\u25CE' },
      { id: 'checkbox-checked', char: '☑', name: '勾选框', unicode: '\u2611' },
      { id: 'checkbox-crossed', char: '☒', name: '叉选框', unicode: '\u2612' },
    ]
  },
  {
    id: 'numbers',
    name: '数字类',
    icon: '🔢',
    defaultVisible: 10,
    symbols: [
      { id: 'num-1', char: '①', name: '数字1', unicode: '\u2460' },
      { id: 'num-2', char: '②', name: '数字2', unicode: '\u2461' },
      { id: 'num-3', char: '③', name: '数字3', unicode: '\u2462' },
      { id: 'num-4', char: '④', name: '数字4', unicode: '\u2463' },
      { id: 'num-5', char: '⑤', name: '数字5', unicode: '\u2464' },
      { id: 'num-6', char: '⑥', name: '数字6', unicode: '\u2465' },
      { id: 'num-7', char: '⑦', name: '数字7', unicode: '\u2466' },
      { id: 'num-8', char: '⑧', name: '数字8', unicode: '\u2467' },
      { id: 'num-9', char: '⑨', name: '数字9', unicode: '\u2468' },
      { id: 'num-10', char: '⑩', name: '数字10', unicode: '\u2469' },
    ]
  },
  {
    id: 'emojis',
    name: '表情类',
    icon: '😊',
    defaultVisible: 8,
    symbols: [
      { id: 'smile', char: '😊', name: '微笑', unicode: '\uD83D\uDE0A' },
      { id: 'grin', char: '😀', name: '露齿笑', unicode: '\uD83D\uDE00' },
      { id: 'happy', char: '😃', name: '开心', unicode: '\uD83D\uDE03' },
      { id: 'laugh', char: '😄', name: '大笑', unicode: '\uD83D\uDE04' },
      { id: 'beam', char: '😁', name: '咧嘴笑', unicode: '\uD83D\uDE01' },
      { id: 'joy', char: '😆', name: '眯眼笑', unicode: '\uD83D\uDE06' },
      { id: 'rofl', char: '🤣', name: '笑哭', unicode: '\uD83E\uDD23' },
      { id: 'tears', char: '😂', name: '喜极而泣', unicode: '\uD83D\uDE02' },
      { id: 'thumbs-up', char: '👍', name: '点赞', unicode: '\uD83D\uDC4D' },
      { id: 'thumbs-down', char: '👎', name: '踩', unicode: '\uD83D\uDC4E' },
      { id: 'clap', char: '👏', name: '鼓掌', unicode: '\uD83D\uDC4F' },
      { id: 'muscle', char: '💪', name: '加油', unicode: '\uD83D\uDCAA' },
      { id: 'party', char: '🎉', name: '庆祝', unicode: '\uD83C\uDF89' },
      { id: 'heart', char: '❤️', name: '爱心', unicode: '\u2764\uFE0F' },
      { id: 'hundred', char: '💯', name: '满分', unicode: '\uD83D\uDCAF' },
      { id: 'fire', char: '🔥', name: '火', unicode: '\uD83D\uDD25' },
      { id: 'thinking', char: '🤔', name: '思考', unicode: '\uD83E\uDD14' },
      { id: 'confused', char: '😕', name: '困惑', unicode: '\uD83D\uDE15' },
      { id: 'worried', char: '😟', name: '担心', unicode: '\uD83D\uDE1F' },
      { id: 'sad', char: '😢', name: '伤心', unicode: '\uD83D\uDE22' },
    ]
  }
];

// 获取符号分类
export const getSymbolCategory = (categoryId: string): SymbolCategory | undefined => {
  return SYMBOL_CATEGORIES.find(cat => cat.id === categoryId);
};

// 获取符号
export const getSymbol = (symbolId: string): SymbolItem | undefined => {
  for (const category of SYMBOL_CATEGORIES) {
    const symbol = category.symbols.find(s => s.id === symbolId);
    if (symbol) return symbol;
  }
  return undefined;
};

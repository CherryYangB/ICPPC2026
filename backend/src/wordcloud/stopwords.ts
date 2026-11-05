/**
 * 词云停用词（最小可用集）。
 *
 * 只用于过滤「非词表词」——领域词（受保护还原）与归一目标词不受停用词影响。
 * 需要扩充时直接往数组里加即可。
 */
const CHINESE_STOPWORDS = [
  '的', '了', '和', '与', '及', '或', '是', '在', '有', '我', '你', '他', '她', '它',
  '我们', '你们', '他们', '这', '那', '这个', '那个', '这些', '那些', '一个', '一些',
  '也', '都', '就', '很', '太', '又', '还', '要', '会', '能', '可以', '不', '没', '没有',
  '吗', '呢', '吧', '啊', '呀', '哦', '嗯', '的话', '因为', '所以', '但是', '而且',
  '如果', '虽然', '然后', '以及', '对于', '关于', '通过', '进行', '需要', '应该', '可能',
  '觉得', '认为', '希望', '建议', '大家', '等等', '什么', '怎么', '如何', '为什么',
  '时候', '方面', '上', '下', '中', '里', '来', '去', '说', '做', '让', '把', '被',
  '给', '对', '从', '到', '更', '最', '比较', '非常', '特别', '一直', '已经', '正在',
  '只是', '还有', '或者', '不过', '并且', '同时', '之间', '自己', '这样', '那样',
  '一定', '主要', '相关', '目前', '现在', '以后', '之前', '各种', '每个', '所有',
]

const ENGLISH_STOPWORDS = [
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'him', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'may', 'might', 'must', 'my',
  'no', 'not', 'of', 'on', 'or', 'our', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'to', 'too', 'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
  'who', 'why', 'will', 'with', 'would', 'you', 'your', 'also', 'more', 'most',
  'about', 'over', 'under', 'between', 'during', 'before', 'after', 'just', 'only',
  'very', 'much', 'many', 'all', 'any', 'each', 'other', 'own', 'same', 'both', 'few',
  'again',
]

export const STOPWORDS: ReadonlySet<string> = new Set([
  ...CHINESE_STOPWORDS,
  ...ENGLISH_STOPWORDS,
])

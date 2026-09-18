/**
 * 公開內容頁前端模組，組合 CMS 資料、靜態備援內容與頁面視覺區塊。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：前端靜態頁面資料，作為 CMS API 無資料時的預設內容。

const generated = "/assets/generated";
const formal = "/assets/figma-formal";

// 詳細註解：PlaceChapter 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
export type PlaceChapter = {
  id: "qishan" | "meinong" | "neimen";
  number: string;
  name: string;
  subtitle: string;
  description: string[];
  coverImage: string;
  fallbackImage: string;
  coverAlt: string;
  href: string;
  note: string;
  x: string;
  y: string;
  tags: string[];
};

export const places: PlaceChapter[] = [
  {
    id: "qishan",
    number: "01",
    name: "旗山",
    subtitle: "從老街、宗教文化到農產與餐飲的地方產業現場",
    description: [
      "旗山是本年度活動的主要起點，從宗教文化探訪、街區介紹到產業歷史漫談，逐步建立地方敘事的資料底稿。",
      "後續以火龍果、小火鍋等在地產業分享補足生活面向，讓旗山不只是一條老街，而是一個仍在生產故事的地方網絡。",
    ],
    coverImage: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/place/qishan/large/%E6%97%97%E5%B1%B1.webp",
    fallbackImage: `${formal}/story-card-02.png`,
    coverAlt: "旗山地方街區與文化場域",
    href: "/places/qishan",
    note: "老街紋理\n產業故事與宗教文化",
    x: "10.6%",
    y: "75.5%",
    tags: ["老街", "宗教文化", "農產", "餐飲"],
  },
  {
    id: "meinong",
    number: "02",
    name: "美濃",
    subtitle: "把客家文化、藍染工藝與地方記憶轉成內容素材",
    description: [
      "美濃活動聚焦文化記憶與工藝創作，透過藍染文創設計工坊與系列分享，將地方知識轉譯成可被展示與再創作的內容。",
      "從《六堆風雲》到客家文化，再到居民記憶整理，美濃成為文化深度與內容編輯並進的場域。",
    ],
    coverImage: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/place/meinong/large/%E7%BE%8E%E6%BF%83.webp",
    fallbackImage: `${generated}/magazine-asset-02-food.png`,
    coverAlt: "美濃文化與工藝場域",
    href: "/places/meinong",
    note: "客家文化\n藍染工藝與地方記憶",
    x: "64.8%",
    y: "56.8%",
    tags: ["客家文化", "藍染", "地方記憶", "雜誌敘事"],
  },
  {
    id: "neimen",
    number: "03",
    name: "內門",
    subtitle: "從宋江陣看見民俗、身體記憶與社群傳承",
    description: [
      "內門以宋江陣作為文化入口，將民俗演練、地方信仰與社群傳承轉為可被年輕世代理解的故事。",
      "這個場域補足年度計畫中的民俗面向，也讓旗美內門的文化版圖更完整。",
    ],
    coverImage: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/place/neimen/large/%E5%85%A7%E9%96%80.webp",
    fallbackImage: `${generated}/magazine-asset-05-festival.png`,
    coverAlt: "內門宋江陣與民俗文化",
    href: "/places/neimen",
    note: "宋江陣\n民俗身體與社群傳承",
    x: "89.4%",
    y: "15.2%",
    tags: ["宋江陣", "民俗", "信仰", "傳承"],
  },
];

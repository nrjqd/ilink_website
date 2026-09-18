/**
 * 公開內容頁前端模組，組合 CMS 資料、靜態備援內容與頁面視覺區塊。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：關於 I-LINK 頁面，組合頁首、內容區塊與頁尾。

import "./AboutILink.css";
import { SafeImage } from "../../shared/SafeMedia";

const ABOUT_STORY_IMAGE =
  "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/pages/about/about-story/about-story.webp";

const values = [
  {
    title: "尊重",
    text: "從居民生活與地方脈絡出發，先理解，再把故事帶給更多人看見。",
    color: "gold",
  },
  {
    title: "記錄",
    text: "透過訪談、影像、走讀與文字，把散落經驗轉成能閱讀、能分享的內容。",
    color: "gray",
  },
  {
    title: "連結",
    text: "串起學校、社群、店家與創作者，讓地方素材不只被保存，也能被再創作。",
    color: "pink",
  },
  {
    title: "傳承",
    text: "讓文化不只停在一次活動，而能延伸到教育、旅遊、自媒體與地方行動。",
    color: "green",
  },
];

const planSteps = [
  {
    number: "01",
    title: "田野踏查",
    text: "進入旗山、美濃、內門，整理街區、產業與生活路徑。",
    color: "gold",
  },
  {
    number: "02",
    title: "地方採集",
    text: "以訪談、攝影與筆記記錄居民記憶與文化線索。",
    color: "gray",
  },
  {
    number: "03",
    title: "內容編輯",
    text: "把資料轉成故事、地圖、影音、展件與可延伸的數位內容。",
    color: "pink",
  },
  {
    number: "04",
    title: "共創活動",
    text: "透過走讀、工作坊與展演，讓更多人參與地方敘事。",
    color: "green",
  },
  {
    number: "05",
    title: "持續發布",
    text: "累積作品、活動與合作資料，形成能持續導流的地方內容平台。",
    color: "gold",
  },
];
const partners = [
  {
    name: "I-LINK 負責人\n邱永琦老師",
    logo: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/pages/about/partners/I-Link%E8%B2%A0%E8%B2%AC%E4%BA%BA_%E9%82%B1%E6%B0%B8%E7%90%A6%E8%80%81%E5%B8%AB.webp",
    imageFit: "cover",
  },
  {
    name: "實踐大學\n高雄校區",
    logo: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/pages/about/partners/%E5%AF%A6%E8%B8%90%E5%A4%A7%E5%AD%B8%E9%AB%98%E9%9B%84%E6%A0%A1%E5%8D%80.webp",
    imageFit: "contain",
  },
  {
    name: "精功社區\n許崇德理事長",
    logo: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/pages/about/partners/%E7%B2%BE%E5%8A%9F%E7%A4%BE%E5%8D%80%E8%A8%B1%E5%B4%87%E5%BE%B7%E7%90%86%E4%BA%8B%E9%95%B7.webp",
    imageFit: "cover",
  },
  {
    name: "美濃藍有限公司\n楊智雅老師",
    logo: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/pages/about/partners/%E7%BE%8E%E6%BF%83%E8%97%8D%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8%E6%A5%8A%E6%99%BA%E9%9B%85%E8%80%81%E5%B8%AB.webp",
    imageFit: "cover",
  },
  {
    name: "網頁負責人\n袁宇成",
    logo: "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/pages/about/partners/%E7%B6%B2%E9%A0%81%E8%B2%A0%E8%B2%AC%E4%BA%BA_%E8%A2%81%E5%AE%87%E6%88%90.webp",
    imageFit: "cover",
  },
];

// 詳細註解：AboutILink 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function AboutILink() {
  return (
    <section className="about-i-link" aria-label="關於 I-LINK">
      <section className="about-section intro-section" aria-labelledby="about-who-title">
        <div className="about-container intro-grid">
          <div className="section-heading">
            <span className="section-eyebrow">我們是誰</span>
            <h2 id="about-who-title">
              讓地方故事
              <br />
              被更多人看見
            </h2>
          </div>

          <div className="intro-copy">
            <p>
              I-LINK 連結旗山、美濃、內門的地方場域、工作者、學生與創作者，將散落在街區、
              產業、民俗與日常生活裡的文化線索，整理成可以被閱讀、分享與持續擴充的內容。
            </p>
            <p>
              我們相信地方不是單一景點，而是一組由人、記憶、路徑與行動構成的故事網絡。
            </p>
          </div>

          <figure className="intro-image-wrap">
            <SafeImage src={ABOUT_STORY_IMAGE} alt="I-LINK 團隊在地方現場交流" />
            <span className="intro-dot" aria-hidden="true" />
          </figure>
        </div>
      </section>

      <section className="about-section values-section" aria-labelledby="about-values-title">
        <div className="about-container values-grid">
          <div className="section-heading">
            <span className="section-eyebrow">我們的理念</span>
            <h2 id="about-values-title">
              從採集到發布
              <br />
              建立內容循環
            </h2>
          </div>

          <div className="values-list">
            {values.map((value) => (
              <article className="value-card" key={value.title}>
                <span className={`value-dot value-dot--${value.color}`} aria-hidden="true" />
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section plan-section" aria-labelledby="about-plan-title">
        <div className="about-container plan-grid">
          <div className="section-heading">
            <span className="section-eyebrow">我們的計畫</span>
            <h2 id="about-plan-title">
              把地方現場
              <br />
              轉成傳播內容
            </h2>
          </div>

          <div className="plan-timeline" aria-label="I-LINK 計畫流程">
            {planSteps.map((step) => (
              <article className="plan-timeline-item" key={step.number}>
                <div className={`plan-timeline-number plan-timeline-number--${step.color}`}>
                  {step.number}
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section partners-section" aria-labelledby="about-partners-title">
        <div className="about-container partners-grid">
          <div className="section-heading">
            <span className="section-eyebrow">合作單位</span>
            <h2 id="about-partners-title">
              一起讓地方
              <br />
              被更多人看見
            </h2>
          </div>

          <div className="partners-list">
            {partners.map((partner) => (
              <article className="partner-item" key={partner.name}>
                <SafeImage
                  src={partner.logo}
                  alt={partner.name.replace("\n", " ")}
                  className={`partner-image partner-image--${partner.imageFit}`}
                />
                <span>
                  {partner.name.split("\n").map((line) => (
                    <span key={line}>
                      {line}
                      <br />
                    </span>
                  ))}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

import "@/styles/page-loader.css";

export default function PageLoader() {
  return (
    <div className="tnc-loader-wrapper">
      <div className="tnc-loader-inner">
        <div className="tnc-loader">
          <span>
            <span /><span /><span /><span />
          </span>
          <div className="tnc-base">
            <span />
            <div className="tnc-face" />
          </div>
        </div>
        <div className="tnc-longfazers">
          <span /><span /><span /><span />
        </div>
      </div>
    </div>
  );
}

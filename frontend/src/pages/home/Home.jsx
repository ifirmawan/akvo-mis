import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import "./style.scss";
import { AkvoIcon } from "../../components/Icons";
import { config, store, uiText } from "../../lib";

const Home = () => {
  const language = store.useState((s) => s.language);
  const { active: activeLang } = language;
  const text = useMemo(() => {
    return uiText[activeLang];
  }, [activeLang]);

  useEffect(() => {
    // Create a script element to load script.js
    const script = document.createElement("script");
    script.src = "/js/script.js";
    script.async = true;

    // Add the script to the document
    document.body.appendChild(script);

    // Clean up function to remove the script when component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <main className="content js-content">
      <section className="block">
        <figure className="item-parallax-media ">
          <img
            src={text.homeJumbotronImage.src}
            alt={text.homeJumbotronImage.alt}
            style={{
              height: "100vh",
              width: "100%",
              objectFit: "cover",
              objectPosition: "center",
              filter: "brightness(0.8)",
              position: "absolute",
              left: 0,
              zIndex: -1,
              transition: "filter 0.3s ease-in-out",
            }}
          />
        </figure>
        <div className="item-parallax-content flex-container">
          <div className="landing-content">
            <h1 className="head-xl">{text.homeJumbotronTitle}</h1>
            <span className="head-title">{text.homeJumbotronSubtitle}</span>
          </div>
        </div>
      </section>

      <section className="block section-mandate">
        <div
          className="item-parallax-content centered-content section-container"
          style={{ paddingTop: 128, paddingBottom: 128 }}
        >
          <h1 className="head-md head-centered">{text.homeMandateTitle}</h1>
          <p className="section-caption-text">{text.homeMandateText}</p>
        </div>
        <div className="item-parallax-content flex-container img-grid">
          <figure className="img-gridItem type-left">
            <img src="/assets/department-structure.jpg" alt="Department" />
            <figcaption className="img-caption">
              <h2 className="head-title">{text.homeStructureTitle}</h2>
              <p className="copy">{text.homeStructureText}</p>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="block" id="key-roles">
        <div
          className="centered-content section-container"
          style={{ paddingTop: 128, paddingBottom: 128 }}
        >
          <h1 className="head-md head-centered">{text.homeKeyRolesTitle}</h1>
          <p className="section-caption-text">{text.homeKeyRolesText}</p>
        </div>
        <div className="item-parallax-content flex-container img-grid">
          {text.homeKeyRolesItems.map((item, index) => (
            <figure key={index} className={`img-gridItem type-${item.type}`}>
              <img src={item.imgSrc} alt={item.imgAlt} />
              <figcaption className="img-caption">
                <h2 className="head-title">{item.title}</h2>
                <p className="copy copy-white">{item.text}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="block footer-section ">
        <div className="flex-container section-container">
          <div className="footer-column footer-column-1">
            <div className="footer-logo-container">
              <Link to="/">
                <div className="footer-logo">
                  <img src={config.siteLogo} alt={config.siteLogo} />
                </div>
              </Link>
            </div>
          </div>
          <div className="footer-column footer-column-2 text-sm text-white/60">
            <h4 className="head-sm">{text.homeFooterQuickLinksTitle}</h4>
            <ul className="quick-links-list">
              {text.homeQuickLinks.map((link, index) => (
                <li key={index} className="mb-2">
                  {link.isPage ? (
                    <Link to={link.href} className="text-white/60">
                      {link.text}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-white/60"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.text}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column footer-column-2 text-sm text-white/60">
            <h4 className="head-sm">{text.homeFooterContactTitle}</h4>
            <div className="flex items-start mb-2">
              <div>
                {text.homeFooterContactDetails.map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="flex items-start mb-2">
              <div>
                {text.homeFooterContactAddress.map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <a
                href={`tel:${text.homeFooterContactPhone.replace(
                  /\(|\)|\s/g,
                  ""
                )}`}
              >
                <span>{text.homeFooterContactPhone}</span>
              </a>
            </div>
          </div>
          <div className="footer-column footer-column-2 text-sm text-white/60">
            <h4 className="head-sm">{text.homeFooterAboutTitle}</h4>
            <div className="flex items-start mb-2">
              <div>{text.homeFooterAboutText}</div>
            </div>
          </div>
        </div>
        <div className="footer-copyright">
          <div>
            <p className="copy copy-white">{text.homeFooterCopyrightText}</p>
          </div>
          <div className="powered-by-container">
            <span className="copy copy-white">
              {text.homeFooterPoweredByText}
            </span>
            <span>
              <AkvoIcon />
            </span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default React.memo(Home);

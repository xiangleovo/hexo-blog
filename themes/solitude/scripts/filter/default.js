"use strict";

hexo.extend.filter.register("after_post_render", function (data) {
  data.title = data.title || "Untitled";
  const { config } = hexo.theme;

  const setCoverAndExcerpt = (layout) => {
    const { copyright, locate, cover } = hexo.theme.config[layout].default;
    data.locate = data.locate || locate;
    data.cc = data.cc || copyright;
    data.cover =
      data.cover || (cover?.length && cover[getRandomInt(0, cover.length)]);
    data.not_cover = data.cover ? false : true;
    data.excerpt =
      layout === "post" ? data.description || data.excerpt : data.title;
    data.toc = !!(config.aside.toc[layout] && data.toc !== false);
    data.aside = layout === "post" ? data.aside || true : data.aside || false;
  };

  if (data.layout === "post" || data.layout === "page") {
    setCoverAndExcerpt(data.layout);
  }

  data.comment = !!(config.comment.use && data.comment !== false);
  return data;
});

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + Math.ceil(min);
}

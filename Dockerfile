FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/snippets/ /etc/nginx/snippets/
COPY index.html docs.html verify.html /usr/share/nginx/html/
COPY robots.txt sitemap.xml 404.html manifest.webmanifest /usr/share/nginx/html/
COPY styles/ /usr/share/nginx/html/styles/
COPY src/ /usr/share/nginx/html/src/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 8080

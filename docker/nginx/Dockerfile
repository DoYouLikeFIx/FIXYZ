FROM nginx:1.27-alpine

RUN apk add --no-cache bash openssl gettext \
    && rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf
COPY templates/fixyz-edge.conf.template /etc/nginx/templates/fixyz-edge.conf.template
COPY scripts/generate-dev-cert.sh /usr/local/bin/generate-dev-cert.sh
COPY scripts/renew-dev-cert.sh /usr/local/bin/renew-dev-cert.sh
COPY docker-entrypoint.sh /usr/local/bin/fixyz-nginx-entrypoint.sh

RUN chmod +x /usr/local/bin/generate-dev-cert.sh \
    /usr/local/bin/renew-dev-cert.sh \
    /usr/local/bin/fixyz-nginx-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/fixyz-nginx-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

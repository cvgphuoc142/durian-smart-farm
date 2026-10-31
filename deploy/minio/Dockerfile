# MinIO built from its last source release. Upstream stopped publishing images, and the
# Chainguard build needs an x86-64-v2 CPU, which this VPS lacks. GOAMD64=v1 runs on any x86-64.
FROM golang:1.24-bookworm AS build
ARG MINIO_TAG=RELEASE.2025-10-15T17-29-55Z
RUN git clone --depth 1 --branch "$MINIO_TAG" https://github.com/minio/minio.git /src
WORKDIR /src
ENV CGO_ENABLED=0 GOAMD64=v1 GOFLAGS=-p=1
RUN go build -trimpath -ldflags "-s -w" -o /out/minio .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* && useradd -r -u 65532 minio
COPY --from=build /out/minio /usr/local/bin/minio
USER 65532
EXPOSE 9000
ENTRYPOINT ["minio"]

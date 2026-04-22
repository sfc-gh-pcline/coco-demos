FROM node:22-slim AS frontend
WORKDIR /build
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir flask requests gunicorn
COPY server/app.py ./app.py
COPY --from=frontend /build/dist ./static
ENV STATIC_DIR=/app/static
ENV PORT=8080
EXPOSE 8080
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "60", "app:app"]

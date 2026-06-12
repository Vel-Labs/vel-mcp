# This Dockerfile is intentionally minimal and does not download model weights.
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml ./
COPY vel_locate_anything_worker ./vel_locate_anything_worker
RUN pip install --no-cache-dir -e .
CMD ["python", "-m", "vel_locate_anything_worker.main"]

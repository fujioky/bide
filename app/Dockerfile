FROM public.ecr.aws/docker/library/python:3.12-slim
WORKDIR /app
COPY packages/fujioky-auth /packages/fujioky-auth
RUN pip install --no-cache-dir /packages/fujioky-auth
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/bide ./bide
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["sh", "-c", "uvicorn bide.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*' --no-access-log"]

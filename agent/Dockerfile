FROM public.ecr.aws/docker/library/python:3.12-slim
# grok CLI 的安装脚本要 curl + bash；CLI 本体装进持久卷 /data/.grok/bin
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl bash ca-certificates git \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080 HOME=/data PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "main.py"]

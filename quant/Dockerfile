FROM public.ecr.aws/docker/library/python:3.12-slim
LABEL "language"="python"
LABEL "framework"="fastapi"
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8080
CMD ["python", "main.py"]

FROM python:3.13-slim
WORKDIR /app
COPY station/requirements.txt station/requirements.txt
RUN python -m pip install --no-cache-dir -r station/requirements.txt \
    && useradd --create-home astra
COPY start.py smoke_test.py ./
COPY station/astra station/astra
COPY station/data station/data
COPY station/static station/static
COPY station/web station/web
COPY station/demo_app.py station/discussion_ai.py station/public_sessions.py station/
USER astra
ENV ASTRA_HOST=0.0.0.0 PORT=8080 PYTHONDONTWRITEBYTECODE=1
EXPOSE 8080
CMD ["python", "start.py"]

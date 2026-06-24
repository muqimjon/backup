IMAGE      ?= muqimjon/backup
SC_VERSION ?= 0.2.29

.PHONY: all postgres mysql mssql minio postgres-minio push clean

all: postgres mysql mssql minio postgres-minio

postgres:
	docker build \
		--build-arg SUPERCRONIC_VERSION=$(SC_VERSION) \
		-f workers/images/postgres/Dockerfile \
		-t $(IMAGE):postgres \
		.

mysql:
	docker build \
		--build-arg SUPERCRONIC_VERSION=$(SC_VERSION) \
		-f workers/images/mysql/Dockerfile \
		-t $(IMAGE):mysql \
		.

mssql:
	docker build \
		--build-arg SUPERCRONIC_VERSION=$(SC_VERSION) \
		-f workers/images/mssql/Dockerfile \
		-t $(IMAGE):mssql \
		.

minio:
	docker build \
		--build-arg SUPERCRONIC_VERSION=$(SC_VERSION) \
		-f workers/images/minio/Dockerfile \
		-t $(IMAGE):minio \
		.

postgres-minio:
	docker build \
		--build-arg SUPERCRONIC_VERSION=$(SC_VERSION) \
		-f workers/images/postgres-minio/Dockerfile \
		-t $(IMAGE):postgres-minio \
		.

push:
	docker push $(IMAGE):postgres
	docker push $(IMAGE):mysql
	docker push $(IMAGE):mssql
	docker push $(IMAGE):minio
	docker push $(IMAGE):postgres-minio

clean:
	docker rmi $(IMAGE):postgres $(IMAGE):mysql $(IMAGE):mssql \
	           $(IMAGE):minio $(IMAGE):postgres-minio 2>/dev/null || true

setlocal enabledelayedexpansion

SET image_name=grslin/gjjr_kvs

docker build -t %image_name% .

docker rm -f replica1 replica2 replica3

docker run -d --name=replica1 -p 8080:8080 -e VIEW="176.32.164.10:8080,176.32.164.10:8081,176.32.164.10:8082" -e IP_PORT="176.32.164.10:8080" %image_name%
docker run -d --name=replica2 -p 8081:8080 -e VIEW="176.32.164.10:8080,176.32.164.10:8081,176.32.164.10:8082" -e IP_PORT="176.32.164.10:8081" %image_name%
docker run -d --name=replica3 -p 8082:8080 -e VIEW="176.32.164.10:8080,176.32.164.10:8081,176.32.164.10:8082" -e IP_PORT="176.32.164.10:8082" %image_name%


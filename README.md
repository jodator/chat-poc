Know issues when starting:

- setup redis server to listen on all IPs on host:

`bind 0.0.0.0`

- build docker images:

`docker build -f front/Dockerfile -t jodator/chat-poc-front .`
`docker build -f back/Dockerfile -t jodator/chat-poc-back .`

- run front server image:

`docker run -p 3000:3000 jodator/chat-poc-back`

- check your `docker0` host ip:

`ip route show | grep docker0 | awk '{print $9}'`

- run back server image (use `docker0` ip):

`docker run -p 3001:3001 -d --add-host=parent-host:172.17.0.1 jodator/chat-poc-back`

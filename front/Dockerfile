FROM node:latest

MAINTAINER Maciej Gołaszewski <jodator@gmail.com>

# Install app dependencies straight from package.json
COPY package.json /src/package.json
RUN cd /src; npm install --production

# Copy esential files
COPY front/src/server.js /src
COPY front/public /public

# Run node server
CMD ["node", "/src/server.js"]

# Do not expose any ports since ports are defined by docker run now

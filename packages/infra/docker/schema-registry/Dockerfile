# syntax=docker/dockerfile:1
FROM confluentinc/cp-schema-registry:8.2.4
ADD --chmod=644 \
  https://github.com/aws/aws-msk-iam-auth/releases/download/v2.3.7/aws-msk-iam-auth-2.3.7-all.jar \
  /usr/share/java/schema-registry/
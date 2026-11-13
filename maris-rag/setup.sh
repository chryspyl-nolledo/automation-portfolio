#!/bin/bash
# Project 14 - RAG Vessel Safety Manual Assistant (Lambda + Gemini). Run in AWS CloudShell.
set -e
REGION=${AWS_REGION:-ap-southeast-1}
FN=horizon-star-rag
ROLE=horizon-star-rag-role
SECRET=gemini-api-key
ACCT=$(aws sts get-caller-identity --query Account --output text)

echo "== 1. Budget alarm ($5/month, email) =="
read -p "Email para sa budget alert: " EMAIL
aws budgets create-budget --account-id $ACCT \
 --budget "{\"BudgetName\":\"rag-demo-5usd\",\"BudgetLimit\":{\"Amount\":\"5\",\"Unit\":\"USD\"},\"TimeUnit\":\"MONTHLY\",\"BudgetType\":\"COST\"}" \
 --notifications-with-subscribers "[{\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":80,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$EMAIL\"}]}]" \
 || echo "(budget exists na o nag-error - ok lang, ituloy)"

echo "== 2. Gemini key -> Secrets Manager (hindi makikita habang tina-type) =="
read -s -p "I-paste ang Gemini API key: " GKEY; echo
aws secretsmanager create-secret --name $SECRET --secret-string "$GKEY" --region $REGION >/dev/null 2>&1 \
 || aws secretsmanager put-secret-value --secret-id $SECRET --secret-string "$GKEY" --region $REGION >/dev/null
unset GKEY
SECRET_ARN=$(aws secretsmanager describe-secret --secret-id $SECRET --region $REGION --query ARN --output text)

echo "== 3. IAM role =="
aws iam create-role --role-name $ROLE --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null 2>&1 || true
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name $ROLE --policy-name polly-speak --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"polly:SynthesizeSpeech","Resource":"*"}]}'
aws iam put-role-policy --role-name $ROLE --policy-name read-gemini-secret --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"secretsmanager:GetSecretValue\",\"Resource\":\"$SECRET_ARN\"}]}"
echo "Naghihintay ng role (15s)..."; sleep 15

echo "== 4. Lambda =="
rm -f fn.zip; cd lambda && zip -q ../fn.zip lambda_function.py manual.json about.json && cd ..
ROLE_ARN=arn:aws:iam::$ACCT:role/$ROLE
if aws lambda get-function --function-name $FN --region $REGION >/dev/null 2>&1; then
  aws lambda update-function-code --function-name $FN --zip-file fileb://fn.zip --region $REGION >/dev/null
else
  aws lambda create-function --function-name $FN --runtime python3.12 --handler lambda_function.handler \
   --role $ROLE_ARN --zip-file fileb://fn.zip --timeout 30 --memory-size 256 --region $REGION \
   --environment "Variables={SECRET_ID=$SECRET,GEN_MODEL=gemini-3.5-flash-lite,POLLY_VOICE=Salli,POLLY_ENGINE=neural}" >/dev/null
fi
aws lambda put-function-concurrency --function-name $FN --reserved-concurrent-executions 2 --region $REGION >/dev/null \
 || echo "(reserved concurrency skipped - new account limit, ok lang)"

echo "== 5. Public URL (CORS para sa website mo lang) =="
read -p "Website origin (halimbawa https://d123alnn5vo5uv.cloudfront.net): " ORIGIN
aws lambda create-function-url-config --function-name $FN --auth-type NONE --region $REGION \
 --cors "{\"AllowOrigins\":[\"$ORIGIN\"],\"AllowMethods\":[\"POST\"],\"AllowHeaders\":[\"content-type\"],\"MaxAge\":3600}" >/dev/null 2>&1 \
 || aws lambda update-function-url-config --function-name $FN --auth-type NONE --region $REGION \
 --cors "{\"AllowOrigins\":[\"$ORIGIN\"],\"AllowMethods\":[\"POST\"],\"AllowHeaders\":[\"content-type\"],\"MaxAge\":3600}" >/dev/null
aws lambda add-permission --function-name $FN --statement-id url-invoke --action lambda:InvokeFunctionUrl \
 --principal "*" --function-url-auth-type NONE --region $REGION >/dev/null 2>&1 || true
aws lambda add-permission --function-name $FN --statement-id url-invoke2 --action lambda:InvokeFunction \
 --principal "*" --invoked-via-function-url --region $REGION >/dev/null 2>&1 || true
URL=$(aws lambda get-function-url-config --function-name $FN --region $REGION --query FunctionUrl --output text)

echo "== 6. Test =="
sleep 5
curl -s -X POST "$URL" -H 'content-type: application/json' -d '{"question":"Ano ang EPIRB?"}'
echo; echo; echo "FUNCTION URL (put this in web/demo-14.html and web/chatbot.js in place of YOUR_FUNCTION_URL): $URL"

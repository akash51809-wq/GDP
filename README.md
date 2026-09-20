# RAILDESK — Railway Agent ERP

प्रीमियम रेलवे एजेंट बिज़नेस मैनेजमेंट सिस्टम।

## वर्तमान स्थिति

- सुरक्षित लॉगिन और PostgreSQL session store
- प्रीमियम डैशबोर्ड
- PostgreSQL + Prisma foundation
- RailKit आधारित PNR fetch
- PNR details database में auto-save
- हाल के PNR records की सूची
- आगे: पार्टी, manual ticket booking, ledger/payment, cancellation/refund, PDF, WhatsApp और reports

## RailKit PNR Integration

यह सिस्टम RailKit SDK के checkPNRStatus() का उपयोग करता है। RailKit की API key backend environment variable में रखी जाती है; frontend में expose नहीं की जाती।

### Local setup

    cd backend
    npm install
    npx prisma generate
    npx prisma db push

.env में:

    DATABASE_URL=postgresql://...
    SESSION_SECRET=एक-लंबा-random-secret
    FRONTEND_URL=http://localhost:5173
    RAILKIT_API_KEY=आपकी-railkit-api-key

फिर:

    npm run dev

Frontend से लॉगिन के बाद टिकट बुकिंग → PNR केंद्र में 10 अंकों का PNR डालें। सिस्टम RailKit से विवरण प्राप्त करके PostgreSQL के PnrRecord में save करता है।

## महत्वपूर्ण

RailKit integration के लिए वैध RailKit API key आवश्यक है। API key केवल backend environment में रखें और GitHub पर commit न करें।

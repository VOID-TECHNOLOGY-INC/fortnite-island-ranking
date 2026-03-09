import { app } from './index.js';

const port = Number(process.env.PORT || 5001);

app.listen(port, () => {
  console.log(`Functions dev server listening on http://127.0.0.1:${port}`);
});

# Sugar Mailbox 部署指南

这份指南带你一步步把项目对接 Firebase，并在本地或 Vercel 上顺利运行。

## 1. 在 Firebase 控制台创建项目
1. 打开 [Firebase Console](https://console.firebase.google.com/) 并点击 **Add project**。
2. 取一个项目名（例如 `sugar-mailbox`），关闭 Google Analytics 即可。
3. 项目创建好后，点击左上角齿轮 → **Project settings**。
4. 在 “Your apps” 中选择 `</>` Web，注册一个 Web App（名字任意），然后点击 **Register app**。
5. Firebase 会给出一段配置对象，长这样：
   ```js
   // Import the functions you need from the SDKs you need
   import { initializeApp } from "firebase/app";
   import { getAnalytics } from "firebase/analytics";

   // TODO: Add SDKs for Firebase products that you want to use
   // https://firebase.google.com/docs/web/setup#available-libraries

   // Your web app's Firebase configuration
   // For Firebase JS SDK v7.20.0 and later, measurementId is optional
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "<project-id>.firebaseapp.com",
     projectId: "<project-id>",
     storageBucket: "<project-id>.firebasestorage.app",
     messagingSenderId: "430553604960",
     appId: "1:430553604960:web:xxxxxxxxxxxxxxxx",
     measurementId: "G-XXXXXXXXXX" // 如果启用 Analytics 会看到这个字段
   };

   // Initialize Firebase
   const app = initializeApp(firebaseConfig);
   const analytics = getAnalytics(app);
   ```
   复制 `firebaseConfig` 对象里的字段，后面要转成环境变量。`measurementId` 只有启用了 Analytics 才会出现，不配置也没关系。

6. 如果你希望直接使用上面示例中的值，可以把 `firebaseConfig` 中的每个字段复制到 `.env.local`（见下文）对应的变量里即可。

### 字段和环境变量如何对应？

| Firebase 字段             | 环境变量名                         |
| ------------------------- | ---------------------------------- |
| `apiKey`                  | `VITE_FIREBASE_API_KEY`            |
| `authDomain`              | `VITE_FIREBASE_AUTH_DOMAIN`        |
| `projectId`               | `VITE_FIREBASE_PROJECT_ID`         |
| `storageBucket`           | `VITE_FIREBASE_STORAGE_BUCKET`     |
| `messagingSenderId`       | `VITE_FIREBASE_MESSAGING_SENDER_ID`|
| `appId`                   | `VITE_FIREBASE_APP_ID`             |
| `measurementId`（可选）   | `VITE_FIREBASE_MEASUREMENT_ID`     |

> 提示：仓库里有一份可复制的 [`./.env.example`](./.env.example)，把它另存为 `.env.local` 并填入上表中的值即可。

## 2. 启用 Cloud Firestore
1. 在左侧导航栏点击 **Build → Firestore Database**。
2. 点击 **Create database**，选择 **Start in production mode**。
3. 地区（Region）随意，建议离你用户最近。

> 项目读取的是 `artifacts/{projectId}/public/data/sugar_messages` 这个集合路径，所以创建好后就可以直接使用，无需自定义规则。

## 3. 配置环境变量
项目通过 `import.meta.env.VITE_*` 读取配置。无论在本地还是 Vercel，都需要把刚刚复制的 6 个字段写进去。

### 本地开发
1. 在项目根目录复制一份 `.env.example` 并改名为 `.env.local`（不会被提交到 Git）。
2. 按照上表填入对应的值。
3. 如果你的 `firebaseConfig` 里还有 `measurementId`，可以额外增加一行 `VITE_FIREBASE_MEASUREMENT_ID=...`。
4. 保存后重新运行 `npm run dev` 或 `npm run build`。

### Vercel 部署
1. 打开你的 Vercel 项目，进入 **Settings → Environment Variables**。
2. 逐个新增上述 6 个变量，名称和值保持一致。
3. 如果分为 `Production` / `Preview` / `Development` 环境，可以直接勾选 “Apply to all”。
4. 保存后重新 **Deploy**，Vercel 会自动带着新的环境变量重新构建。

## 4. 验证
- 本地执行 `npm run build`：如果环境变量配置正确，构建会顺利通过。
- Vercel 上检查 **Deployments** 日志：能看到 `npm run build` 成功完成。

搞定！以后若更换 Firebase 项目，只要更新这 6 个变量即可。

## 5. PR 出现冲突时怎么办？

当你在 Vercel 或 GitHub 上看到 “This branch has conflicts that must be resolved” 的提示时，说明你当前分支里的一些文件版本已经落后于主分支（通常是 `main` 或 `master`）。可以按照下面的步骤解决：

1. **在本地拉取最新的主分支**
   ```bash
   git fetch origin
   git checkout main           # 或者 master，取决于仓库默认分支
   git pull origin main
   ```

2. **切回你的功能分支并合并主分支最新代码**
   ```bash
   git checkout <your-branch>
   git merge origin/main       # 如果默认分支是 master 就改成 origin/master
   ```

   如果出现冲突，Git 会在文件中用 `<<<<<<<` / `=======` / `>>>>>>>` 标记冲突的两种版本。手动编辑这些文件，保留你真正想要的内容，删除冲突标记后保存。

3. **确认修复冲突并提交**
   ```bash
   git add <file-with-conflict>
   git commit
   ```

4. **把解决后的结果推送上去**
   ```bash
   git push origin <your-branch>
   ```

刷新 Pull Request 页面，冲突提示就会消失，Vercel 也会重新触发部署。如果你使用的是 GitHub 的 “Resolve conflicts” 在线编辑器，也可以直接在网页上完成以上步骤。

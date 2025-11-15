# 星星信箱部署指南

这份指南带你一步步把项目对接 Firebase，并在本地或 Vercel 上顺利运行。

## 1. 在 Firebase 控制台创建项目
1. 打开 [Firebase Console](https://console.firebase.google.com/) 并点击 **Add project**。
2. 取一个项目名（例如 `star-mailbox`），关闭 Google Analytics 即可。
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
4. 在 **Rules** 页签里添加一条允许匿名用户读写留言的规则，然后点击 **Publish** 保存：

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artifacts/{appId}/public/data/sugar_messages/{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

   > 如果你只希望允许写入，可以把 `read` 改成 `get, list` 或者删掉；若未来改用其他登录方式，也可以把 `request.auth != null` 换成更精细的角色判断。

## 3. 启用匿名登录

1. 在 Firebase 控制台左侧导航选择 **Build → Authentication**。
2. 切换到 **Sign-in method** 标签页。
3. 在 **Providers** 列表中找到 **Anonymous**，点击进入并启用它，然后保存。
4. 切换到同一页顶部的 **Settings** 选项卡，在 **Authorized domains** 中添加你的网站域名（例如 `your-project.vercel.app`）。
5. 完成上述设置后重新部署站点，匿名登录即可正常工作。

## 4. 配置环境变量
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

## 5. 验证
- 本地执行 `npm run build`：如果环境变量配置正确，构建会顺利通过。
- Vercel 上检查 **Deployments** 日志：能看到 `npm run build` 成功完成。

搞定！以后若更换 Firebase 项目，只要更新这 6 个变量即可。

## 6. PR 出现冲突时怎么办？

当你在 Vercel 或 GitHub 上看到 “This branch has conflicts that must be resolved” 的提示时，说明你当前分支里的一些文件版本已经落后于主分支（通常是 `main` 或 `master`）。可以按照下面的步骤解决：

### ✅ 有命令行环境时

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

刷新 Pull Request 页面，冲突提示就会消失，Vercel 也会重新触发部署。

### 📱 只有手机或网页时

1. **在 Pull Request 页面点击 “Resolve conflicts”**：GitHub 会在浏览器里打开冲突编辑器。
2. **逐个文件向下滑动，找到 `<<<<<<<` 标记**：每个冲突块上方有两种版本，左侧是主分支，右侧是你当前分支的改动。
3. **手动编辑成想要的内容**：删掉不需要的行以及所有 `<<<<<<<` / `=======` / `>>>>>>>` 标记，只保留最终结果。
4. **点右上角的 “Mark as resolved”**：冲突文件改完后，点击按钮确认。
5. **全部文件都标记完成后，点击 “Commit merge”**：GitHub 会为你自动创建一次合并提交。
6. **返回 Pull Request**：页面会显示冲突已解决，CI / 部署会重新运行。如果需要继续修改，可以直接在网页里使用 “Edit file” 按钮。

> 提示：手机浏览器里同样可以使用 GitHub 的冲突编辑器，横屏能看得更清楚；如有需要也可以切换到 GitHub App，操作位置基本一致。

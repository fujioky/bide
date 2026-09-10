window.LyraData = {
  articles: [
    { id:"phd-salary", cat:"研究", date:"08/21", title:"欧洲各国博士税后工资", summary:"15 个国家的横向对比：月薪、房租、净剩与一点主观评分。", tags:["留学","博士"], read:"8 min", screen:"data", feature:true },
    { id:"flow-matching", cat:"技术", date:"08/18", title:"使用 Flow Matching 训练 3D 人脸生成器", summary:"从一条常微分方程到能跑的训练脚本。", tags:["生成模型","PyTorch"], read:"15 min", screen:"tech", cover:true },
    { id:"lin-gua", cat:"文化", date:"08/20", title:"地泽临", summary:"一个下午，和一支卦。", tags:["易","随笔"], read:"6 min", screen:"essay", hidden:true },
    { id:"diffusion-tutorial", cat:"技术", date:"08/12", title:"理解扩散模型的去噪过程", summary:"三个可拖动的小组件，比三页公式管用。", tags:["扩散模型","交互"], read:"12 min", screen:"tutorial" },
    { id:"year-2026", cat:"随笔", date:"08/02", title:"A Year of Quiet Work", summary:"2026 年度回顾，图比字多。", tags:["年度总结"], read:"9 min", screen:"magazine", cover:true },
    { id:"nextflow", cat:"技术", date:"07/28", title:"把 Nextflow 跑在一台机器上", summary:"生信流水线的最小可用配置。", tags:["生信","工程"], read:"3 min" },
    { id:"seq-notes", cat:"研究", date:"07/19", title:"单细胞测序的三个坑", summary:"批次效应、双细胞、以及过度解释。", tags:["单细胞"], read:"7 min" }
  ],
  cats: ["全部","研究","技术","文化","随笔"],
  sections: {
    tech: [{title:"问题背景",weight:2},{title:"方法",weight:3},{title:"数学推导",weight:2,level:2},{title:"实现细节",weight:2,level:2},{title:"实验结果",weight:2},{title:"讨论与展望",weight:1},{title:"参考文献",weight:1}],
    data: [{title:"薪资总览",weight:3},{title:"生活成本对比",weight:2},{title:"净剩与性价比",weight:2},{title:"方法与数据来源",weight:1}],
    essay: [{title:"临",weight:2},{title:"泽上有地",weight:2},{title:"午后",weight:1}],
    tutorial: [{title:"Step 1 · 添加噪声",weight:2},{title:"Step 2 · 学习逆过程",weight:3},{title:"Step 3 · 采样",weight:2}],
    magazine: [{title:"封面",weight:1},{title:"春",weight:2},{title:"夏",weight:2},{title:"秋与冬",weight:3}]
  },
  grok: [
    { role:"ai", text:"这篇文章讲述了欧洲各国博士的税后工资对比，覆盖 15 个国家。" },
    { role:"user", text:"德国和荷兰哪个工资更高？" },
    { role:"ai", text:"荷兰的博士月薪约 €2,400，德国约 €2,100；但把房租算进去，两者的净剩差距会缩小到 €100 上下。" }
  ]
};

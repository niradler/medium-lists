const inquirer = require("inquirer");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const mediumUserName = "niradler";
let availableLists = [];
let currentList = null;

const inquirerRepeat = async (questions, message, callback) => {
  let answers = [];
  let repeat = true;
  do {
    const input = await inquirer.prompt(questions);
    answers.push(input);
    if (callback) callback(input);
    repeat = (
      await inquirer.prompt([
        {
          type: "confirm",
          name: "repeat",
          message,
        },
      ])
    ).repeat;
  } while (repeat);

  return answers;
};

class Logger {
  constructor(page) {
    this.page = page;
  }
  log(...args) {
    console.log(args);
    this.page.evaluate((args) => console.log(args), args).then(() => {});
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "session-" + mediumUserName,
  });
  const page = await browser.newPage();
  const logger = new Logger(page);

  logger.log("Please Login");
  await page.goto(`https://medium.com`);

  let loggedIn = false;
  while (!loggedIn) {
    loggedIn = await page.evaluate(() => {
      return localStorage.getItem("viewer-status|is-logged-in") === "true";
    });
    await page.waitForTimeout(5000);
    logger.log("Please Login");
  }
  logger.log("Logged In");
  logger.log("Goto lists");
  await page.goto(`https://medium.com/@${mediumUserName}/lists`);
  await page.waitForSelector(
    "div.ft.u.fu.fv.co.fw > div > a.bw.bx.bh.bi.bj.bk"
  );
  availableLists = await page.evaluate(() => {
    let lists = [];
    document
      .querySelectorAll("div.ft.u.fu.fv.co.fw > div > a.bw.bx.bh.bi.bj.bk")
      .forEach((el) =>
        lists.push({
          url: el.href,
          title: el.querySelector("h2").innerText,
          id: el.href.split("-------")[2],
          tags: [],
        })
      );

    return lists;
  });
  console.log("Available Lists:");
  console.table(
    availableLists.map((list) => ({ title: list.title, id: list.id }))
  );
  const listPicker = await inquirer.prompt([
    {
      name: "currentListId",
      message: "Pick a list to organize.",
      type: "list",
      choices: availableLists.map((list) => ({
        name: list.title,
        value: list.id,
      })),
    },
  ]);
  currentList = availableLists.find(
    (list) => list.id === listPicker.currentListId
  );
  logger.log("Goto list", currentList.url);
  await page.goto(currentList.url);
  //   await page.waitForSelector("div.u.nx > a");
  await page.waitForTimeout(2000);
  const scrollToEnd = () => {
    return page.evaluate(async () => {
      let scrollPosition = 0;
      let documentHeight = document.body.scrollHeight;

      while (documentHeight > scrollPosition) {
        window.scrollBy(0, documentHeight);
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        scrollPosition = documentHeight;
        documentHeight = document.body.scrollHeight;
      }

      return document.body.scrollHeight;
    });
  };
  logger.log("scroll to the end (load all)", currentList.url);
  let lastScroll, nextScroll;
  //   do {
  //     lastScroll = await scrollToEnd();
  //     nextScroll = await scrollToEnd();
  //     console.log("Scrolled to end", lastScroll, nextScroll);
  //   } while (lastScroll < nextScroll);

  const removeNotAvailable = await inquirer.prompt([
    {
      name: "remove",
      message: "remove not available?",
      type: "confirm",
    },
  ]);
  if (removeNotAvailable.remove) {
    await page.evaluate(() => {
      document.querySelectorAll("div.os.s.ln > button").forEach((el) => {
        el.click();
      });
    });
  }
  const posts = await page.evaluate(() => {
    let _posts = [];
    document
      .querySelectorAll("div.s.kd > a.bw.bx.bh.bi.bj.bk")
      .forEach((el) => {
        _posts.push({
          url: el.href,
          title:
            el && el.querySelector("h2")
              ? el.querySelector("h2").innerText
              : "",
          summary:
            el && el.querySelector("p") ? el.querySelector("p").innerText : "",
          id: el.href.split("----")[1],
        });
      });
    return _posts;
  });
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(post);
    let match = [];
    availableLists.forEach((list) => {
      console.log(list.tags);
    });
    if (match.length > 0) console.log(match);
    else {
      console.log("pick lists");
      await inquirerRepeat(
        [
          {
            name: "lists",
            message: "Pick a list to tagged.",
            type: "list",
            choices: availableLists.map((list) => ({
              name: list.title,
              value: list.id,
            })),
          },
        ],
        "Tagged more",
        async (answer) => {
          const tags = await inquirerRepeat(
            [
              {
                type: "input",
                name: "tag",
                message: "Enter tag",
              },
            ],
            "Do you want to add another tag ?"
          );
          console.log(answer, tags);
        }
      );
    }
  }

  //   await page.waitForTimeout(50000);
  //   await browser.close();
})();

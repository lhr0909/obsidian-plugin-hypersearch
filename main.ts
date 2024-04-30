import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
import { Voy } from "voy-search";

import { FeatureExtractionPipeline, pipeline, env } from "@xenova/transformers";
import {
  RecursiveCharacterTextSplitter,
  TextSplitter,
} from "langchain/text_splitter";

import { ortWasm } from "./wasms/ort-wasm";
import { ortWasmThreaded } from "./wasms/ort-wasm-threaded";
import { ortWasmSimd } from "./wasms/ort-wasm-simd";
import { ortWasmSimdThreaded } from "./wasms/ort-wasm-simd-threaded";

// Remember to rename these classes and interfaces!

// TODO: see how to set these things up
env.allowRemoteModels = false;
env.localModelPath =
  "/Users/simon/Documents/git-repo/cool/obsidian-vault/.obsidian/plugins/hypersearch/models";

env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = {
  "ort-wasm.wasm": `data:application/octet-stream;base64,${ortWasm}`,
  "ort-wasm-threaded.wasm": `data:application/octet-stream;base64,${ortWasmThreaded}`,
  "ort-wasm-simd.wasm": `data:application/octet-stream;base64,${ortWasmSimd}`,
  "ort-wasm-simd-threaded.wasm": `data:application/octet-stream;base64,${ortWasmSimdThreaded}`,
};

interface HypersearchPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: HypersearchPluginSettings = {
  mySetting: "default",
};

export default class HypersearchPlugin extends Plugin {
  settings: HypersearchPluginSettings;
  extractor: FeatureExtractionPipeline;
  splitter: TextSplitter;
  index: Voy;

  async onload() {
    await this.loadSettings();

    this.extractor = await pipeline("feature-extraction", "Xenova/bge-m3");

    this.splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize: 2048,
      chunkOverlap: 0,
    });

    this.index = new Voy();

    // This creates an icon in the left ribbon.
    // const ribbonIconEl = this.addRibbonIcon(
    //   "dice",
    //   "Sample Plugin",
    //   (evt: MouseEvent) => {
    //     // Called when the user clicks the icon.
    //     new Notice("This is a notice!");
    //   },
    // );
    // Perform additional things with the ribbon
    // ribbonIconEl.addClass("my-plugin-ribbon-class");

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Status Bar Text");

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: "index-all-documents",
      name: "Reindex All Documents",
      callback: async () => {
        console.log("indexing");
        const files = this.app.vault.getFiles();
        console.log(files);
        for (const file of files) {
          if (!file.extension || file.extension !== "md") {
            continue;
          }

          const content = await this.app.vault.read(file);
          const documents = await this.splitter.createDocuments([content]);
          for (const document of documents) {
            console.log(document);
            const id = `${file.path}:${document.metadata.loc?.lines?.from}-${document.metadata.loc?.lines?.to}`;
            const title = file.basename;
            const url = id;

            const embeddings = await this.extractor(document.pageContent, {
              pooling: "cls",
              normalize: true,
            });

            this.index.add({
              embeddings: [
                {
                  id,
                  title,
                  url,
                  embeddings: embeddings.tolist()[0],
                },
              ],
            });
          }
        }

        const indexFile = this.app.vault.getAbstractFileByPath(
          "hypersearch/index.json",
        );

        if (indexFile instanceof TFile) {
          await this.app.vault.delete(indexFile);
        }

        await this.app.vault.create(
          "hypersearch/index.json",
          this.index.serialize(),
        );
        console.log("done indexing");
      },
    });
    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: "reindex-current-document",
      name: "Reindex Current Document",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        // console.log(editor.getSelection());
        // editor.replaceSelection("Sample Editor Command");
        console.log(view.file);
        console.log(editor.getValue());
      },
    });

    // This adds a complex command that can check whether the current state of the app allows execution of the command
    // this.addCommand({
    //   id: "open-sample-modal-complex",
    //   name: "Open sample modal (complex)",
    //   checkCallback: (checking: boolean) => {
    //     // Conditions to check
    //     const markdownView =
    //       this.app.workspace.getActiveViewOfType(MarkdownView);
    //     if (markdownView) {
    //       // If checking is true, we're simply "checking" if the command can be run.
    //       // If checking is false, then we want to actually perform the operation.
    //       if (!checking) {
    //         new SampleModal(this.app).open();
    //       }

    //       // This command will only show up in Command Palette when the check function returns true
    //       return true;
    //     }
    //   },
    // });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SampleSettingTab(this.app, this));

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    // this.registerDomEvent(document, "click", (evt: MouseEvent) => {
    //   console.log("click", evt);
    // });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    // this.registerInterval(
    //   window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
    // );
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleModal extends Modal {
  // biome-ignore lint/complexity/noUselessConstructor: <explanation>
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText("Woah!");
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: HypersearchPlugin;

  constructor(app: App, plugin: HypersearchPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Setting #1")
      .setDesc("It's a secret")
      .addText((text) =>
        text
          .setPlaceholder("Enter your secret")
          .setValue(this.plugin.settings.mySetting)
          .onChange(async (value) => {
            this.plugin.settings.mySetting = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}

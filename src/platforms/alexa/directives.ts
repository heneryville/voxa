import { Card, Response, Template } from "alexa-sdk";
import * as _ from "lodash";
import { IDirective } from "../../directives";
import { ITransition } from "../../StateMachine";
import { IVoxaEvent } from "../../VoxaEvent";
import { IVoxaReply } from "../../VoxaReply";
import { AlexaEvent } from "./AlexaEvent";
import { AlexaReply } from "./AlexaReply";

function isCard(card: any): card is Card {
  if (!("type" in card)) {
    return false;
  }

  return _.includes(["Standard" , "Simple" , "LinkAccount" , "AskForPermissionsConsent"], card.type);
}

export class HomeCard implements IDirective {
  public static platform: string = "alexa";
  public static key: string = "alexaCard";

  constructor(public viewPath: string|Card) { }

  public async writeToReply(reply: IVoxaReply, event: IVoxaEvent, transition: ITransition): Promise<void> {
    if (reply.hasDirective("card")) {
       throw new Error("At most one card can be specified in a response");
    }

    let card: Card;
    if (_.isString(this.viewPath)) {
      card = await event.renderer.renderPath(this.viewPath, event);
      if (!isCard(card)) {
        throw new Error("The view should return a Card like object");
      }
    } else if (isCard(this.viewPath)) {
      card = this.viewPath;
    } else {
      throw new Error("Argument should be a viewPath or a Card like object");
    }

    (reply as AlexaReply).response.card = card;
  }
}

export class Hint implements IDirective {
  public static platform: string = "alexa";
  public static key: string = "alexaHint";

  constructor(public  viewPath: string) { }

  public async writeToReply(reply: IVoxaReply, event: IVoxaEvent, transition: ITransition): Promise<void> {
    if (reply.hasDirective("Hint")) {
      throw new Error("At most one Hint directive can be specified in a response");
    }

    const response: Response = (reply as AlexaReply).response || {};
    if (!response.directives) {
      response.directives = [];
    }

    const text = await event.renderer.renderPath(this.viewPath, event);

    (reply as AlexaReply).response.directives.push( {
      hint: {
        text,
        type: "PlainText",
      },
      type: "Hint",
    });
  }
}

export class DialogDelegate implements IDirective {
  public static platform: string = "alexa";
  public static key: string = "alexaDialogDelegate";

  constructor(public slots?: any) { }

  public async writeToReply(reply: IVoxaReply, event: IVoxaEvent, transition: ITransition): Promise<void> {
    if (!event.intent) {
      throw new Error("An intent is required");
    }

    const directive: any = {
      type: "Dialog.Delegate",
    };

    if (this.slots) {
      const directiveSlots = _(this.slots)
        .map((value, key) => {
          const data: any = {
            confirmationStatus: "NONE",
            name: key,
          };

          if (value) {
            data.value = value;
          }

          return [key, data];
        })
        .fromPairs()
        .value();

      directive.updatedIntent = {
        confirmationStatus: "NONE",
        name: event.intent.name,
        slots: directiveSlots,
      };
    }

    const response: Response = (reply as AlexaReply).response;
    response.directives = response.directives || [];
    response.directives.push(directive);

    (reply as AlexaReply).response = response;
  }
}

export class RenderTemplate implements IDirective {
  public static key: string = "alexaRenderTemplate";
  public static platform: string = "alexa";

  public viewPath?: string;
  public token?: string;
  public template?: Template;

  constructor(viewPath: string|Template, token?: string) {
    if (_.isString(viewPath)) {
      this.viewPath = viewPath;
    } else {
      this.template = viewPath;
    }

    this.token = token;
  }

  public async writeToReply(reply: IVoxaReply, event: IVoxaEvent, transition: ITransition): Promise<void> {
    let template;

    if (reply.hasDirective("Display.RenderTemplate")) {
      throw new Error("At most one Display.RenderTemplate directive can be specified in a response");
    }

    const context = (event.rawEvent as AlexaEvent).context;

    if (!context) {
      return;
    }

    if (! context.System.device.supportedInterfaces.Display) {
      return;
    }

    if (this.viewPath) {
      template = await event.renderer.renderPath(this.viewPath, event, { token: this.token });
    } else {
      template = this.template;
    }

    const response: Response = (reply as AlexaReply).response;
    if (!response.directives) {
      response.directives = [];
    }

    (reply as AlexaReply).response.directives.push(template);
  }
}

export class AccountLinkingCard implements IDirective {
  public static key: string = "alexaAccountLinkingCard";
  public static platform: string = "alexa";

  public async writeToReply(reply: IVoxaReply, event: IVoxaEvent, transition: ITransition): Promise<void> {
    if (reply.hasDirective("card")) {
      throw new Error("At most one card can be specified in a response");
    }

    const card: Card =  { type: "LinkAccount" };
    (reply as AlexaReply).response.card = card;
  }
}

export class PlayAudio implements IDirective {
  public static key: string = "alexaPlayAudio";
  public static platform: string = "alexa";

  constructor(
    public url: string,
    public token: string,
    public offsetInMilliseconds: number,
    public behavior: string = "REPLACE",
  ) { }

  public async writeToReply(reply: IVoxaReply, event: IVoxaEvent, transition: ITransition): Promise<void> {
    if (reply.hasDirective("VideoApp.Launch")) {
      throw new Error("Do not include both an AudioPlayer.Play directive and a VideoApp.Launch directive in the same response");
    }

    const response = (reply as AlexaReply).response;

    if (!response.directives) {
      response.directives = [];
    }

    (reply as AlexaReply).response.directives.push({
      audioItem: { stream: { token: this.token, url: this.url, offsetInMilliseconds: this.offsetInMilliseconds }},
      playBehavior: this.behavior,
      type: "AudioPlayer.Play",
    });
  }
}

export class StopAudio implements IDirective {
  public static key: string = "alexaStopAudio";
  public static platform: string = "alexa";

  public async writeToReply(reply: IVoxaReply, event: IVoxaEvent, transition: ITransition): Promise<void> {
    const response = (reply as AlexaReply).response;

    if (!response.directives) {
      response.directives = [];
    }

    (reply as AlexaReply).response.directives.push({
      type: "AudioPlayer.Stop",
    });
  }
}
/*
Copyright 2005 - 2021 Advantage Solutions, s. r. o.

This file is part of ORIGAM (http://www.origam.org).

ORIGAM is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

ORIGAM is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with ORIGAM. If not, see <http://www.gnu.org/licenses/>.
*/

import React, { Fragment } from "react";
import S from './AuditPlugin.module.scss';
import {
  ILocalization,
  ILocalizer,
  IPluginData,
  IPluginDataView,
  IPluginProperty,
  IPluginTableRow,
  ISectionPlugin
} from "@origam/plugin-interfaces";
import { observer } from "mobx-react";
import { observable } from "mobx";
import moment from "moment";
import { localizations } from "./AuditPluginLocalization";

export class AuditPlugin implements ISectionPlugin {
  $type_ISectionPlugin: 1 = 1;
  id: string = ""

  initialize(xmlAttributes: { [key: string]: string }): void {

  }

  getComponent(data: IPluginData, createLocalizer: (localizations: ILocalization[]) => ILocalizer): JSX.Element {
    return <AuditComponent
      pluginData={data}
      getScreenParameters={this.getScreenParameters}
      localizer={createLocalizer(localizations)}/>;
  }

  @observable
  getScreenParameters: (() => { [parameter: string]: string }) | undefined;
}

@observer
class AuditComponent extends React.Component<{
  pluginData: IPluginData,
  getScreenParameters: (() => { [parameter: string]: string }) | undefined;
  localizer: ILocalizer
}> {

  translate = (key: string, parameters?: { [key: string]: any }) => this.props.localizer.translate(key, parameters);
  dataView = this.props.pluginData.dataView;
  propertiesToRender: IPluginProperty[] = [];

  constructor(props: any) {
    super(props);
    this.propertiesToRender = ["RecordCreated", "refColumnId", "OldValue", "NewValue", "RecordCreatedBy"]
      .map(propId => this.props.pluginData.dataView.properties.find(prop => prop.id === propId)!);
  }

  renderHeader(properties: IPluginProperty[]) {
    return properties.map(property =>
      <Fragment key={property.id}>
        <div className={S.header}>{property.name}</div>
        <div className={S.headerSeparator}></div>
      </Fragment>
    );
  }

  renderRow(row: any[]) {
    return this.propertiesToRender.map(property =>
      <div key={property.id} className={S.column}>
        {this.dataView.getCellText(row, property.id)}
      </div>)
  }

  getGroupContainer() {
    const parameters = this.props.getScreenParameters?.();
    if (!parameters) {
      return undefined;
    }
    const dateFrom = parameters["OrigamDataAuditLog_DateFrom"];
    if (dateFrom.endsWith("01T00:00:00")) {
      return new MonthTimeGroupContainer(this.dataView);
    }
    if (dateFrom.endsWith("00:00:00")) {
      return new DayTimeGroupContainer(this.dataView);
    }
    if (dateFrom.endsWith("00:00")) {
      return new HourTimeGroupContainer(this.dataView);
    }
    return undefined;
  }

  render() {
    const groupContainer = this.getGroupContainer();
    if (this.dataView.tableRows.length === 0 || !groupContainer) {
      return <div>{this.translate("empty")}</div>;
    }

    return (
      <div>
        <div className={S.summary}>
          {this.renderSummary()}
        </div>
        {Array.from(groupContainer.groups.keys())
          .sort((a, b) => a - b)
          .map(subTimeunitValue => this.renderGroup(subTimeunitValue, groupContainer))
        }
      </div>
    );
  }

  renderGroup(subTimeunitValue: number, groupContainer: ITimeGroupContainer) {
    return (
      <div className={S.table}>
        <div className={S.groupHeader}>{groupContainer.makeGroupHeaderText(subTimeunitValue)}</div>
        <div className={S.row}>
          {this.renderHeader(this.propertiesToRender)}
        </div>
        <div className={S.rows}>
          {groupContainer.groups
            .get(subTimeunitValue)!
            .map(row =>
              <div key={this.dataView.getRowId(row)} className={S.row}>
                {this.renderRow(row as any[])}
              </div>)}
        </div>
      </div>
    );
  }

  private renderSummary() {
    const userCount = new Set(
      this.dataView.tableRows
        .map(row => this.dataView.getCellText(row, "RecordCreatedBy"))
    ).size

    return (
      <>{this.translate(
        "recordSummary",
        {recordCount: this.dataView.tableRows.length, userCount: userCount})}</>
    );
  }
}

interface ITimeGroupContainer {
  groups: Map<number, IPluginTableRow[]>

  makeGroupHeaderText(timeUnitValue: number): string;
}

class MonthTimeGroupContainer implements ITimeGroupContainer {
  groups: Map<number, IPluginTableRow[]>;
  dataView: IPluginDataView;

  constructor(dataView: IPluginDataView) {
    this.dataView = dataView;
    this.groups = dataView.tableRows
      .groupBy(row => moment(dataView.getCellText(row, "RecordCreated")).day());
  }

  makeGroupHeaderText(dayOfMonth: number): string {
    const firstRow = this.groups.get(dayOfMonth)![0];
    const firstRecordCreated = moment(this.dataView.getCellText(firstRow, "RecordCreated"))
    return firstRecordCreated.format('MMMM Do');
  }
}

class DayTimeGroupContainer implements ITimeGroupContainer {
  groups: Map<number, IPluginTableRow[]>;
  dataView: IPluginDataView;

  constructor(dataView: IPluginDataView) {
    this.dataView = dataView;
    this.groups = dataView.tableRows
      .groupBy(row => moment(dataView.getCellText(row, "RecordCreated")).hour());
  }

  makeGroupHeaderText(hour: number): string {
    const firstRow = this.groups.get(hour)![0];
    const firstRecordCreated = moment(this.dataView.getCellText(firstRow, "RecordCreated"))
    const endHourMoment = firstRecordCreated.clone().add(-1, 'hours')
    return firstRecordCreated.format('HH:00') + " - " + endHourMoment.format('HH:00');
  }
}

class HourTimeGroupContainer implements ITimeGroupContainer {
  groups: Map<number, IPluginTableRow[]>;
  dataView: IPluginDataView;

  constructor(dataView: IPluginDataView) {
    this.dataView = dataView;
    this.groups = dataView.tableRows
      .groupBy(row => moment(dataView.getCellText(row, "RecordCreated")).minute());
  }

  makeGroupHeaderText(minute: number): string {
    const firstRow = this.groups.get(minute)![0];
    const firstRecordCreated = moment(this.dataView.getCellText(firstRow, "RecordCreated"))
    const endMinuteMoment = firstRecordCreated.clone().add(-1, 'minutes')
    return firstRecordCreated.format('HH:mm') + " - " + endMinuteMoment.format('HH:mm');
  }
}

declare global {
  interface Array<T> {
    groupBy<K>(keyGetter: (key: T) => K): Map<K, T[]>;
  }
}


import React, { useContext, useEffect, useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { FormAppSetting, AppSettingsFormProps, LoadingStates } from '../AppSettings.types';
import { PermissionsContext } from '../Contexts';
import { addOrUpdateFormAppSetting, findFormAppSettingValue, removeFromAppSetting } from '../AppSettingsFormData';
import { CommonConstants, WorkerRuntimeLanguages } from '../../../../utils/CommonConstants';
import DropdownNoFormik from '../../../../components/form-controls/DropDownnoFormik';
import { IDropdownOption, MessageBarType } from '@fluentui/react';
import { RuntimeExtensionMajorVersions } from '../../../../models/functions/runtime-extension';
import { FunctionsRuntimeVersionHelper } from '../../../../utils/FunctionsRuntimeVersionHelper';
import { isLinuxApp } from '../../../../utils/arm-utils';
import { HostStates } from '../../../../models/functions/host-status';
import ConfirmDialog from '../../../../components/ConfirmDialog/ConfirmDialog';
import CustomBanner from '../../../../components/CustomBanner/CustomBanner';
import { Links } from '../../../../utils/FwLinks';

const isVersionChangeSafe = (newVersion: RuntimeExtensionMajorVersions, oldVersion: RuntimeExtensionMajorVersions | null) => {
  if (oldVersion === RuntimeExtensionMajorVersions.custom || newVersion === RuntimeExtensionMajorVersions.custom) {
    // If the user is setting a customer version, we assume they know what they're doing.
    return true;
  }

  switch (oldVersion) {
    case RuntimeExtensionMajorVersions.v1:
      // For V1, changing major versions is not supported.
      return newVersion === RuntimeExtensionMajorVersions.v1;
    case RuntimeExtensionMajorVersions.v2:
    case RuntimeExtensionMajorVersions.v3:
      // For V2 and V3, switching between V2 and V3 is supported.
      return newVersion === RuntimeExtensionMajorVersions.v2 || newVersion === RuntimeExtensionMajorVersions.v3;
    case null:
      return true;
    default:
      return false;
  }
};

const RuntimeVersion: React.FC<AppSettingsFormProps & WithTranslation> = props => {
  const [pendingVersion, setPendingVersion] = useState<RuntimeExtensionMajorVersions | undefined>(undefined);
  const { t, values, initialValues, asyncData, setFieldValue } = props;
  const { app_write, editable, saving } = useContext(PermissionsContext);
  const disableAllControls = !app_write || !editable || saving;

  const initialRuntimeStack =
    findFormAppSettingValue(initialValues.appSettings, CommonConstants.AppSettingNames.functionsWorkerRuntime) || '';
  const runtimeStack = findFormAppSettingValue(values.appSettings, CommonConstants.AppSettingNames.functionsWorkerRuntime) || '';

  const initialRuntimeVersion =
    findFormAppSettingValue(initialValues.appSettings, CommonConstants.AppSettingNames.functionsExtensionVersion) || '';
  const initialRuntimeMajorVersion = FunctionsRuntimeVersionHelper.getFunctionsRuntimeMajorVersion(initialRuntimeVersion);

  const runtimeVersion = findFormAppSettingValue(values.appSettings, CommonConstants.AppSettingNames.functionsExtensionVersion);
  const runtimeMajorVersion = FunctionsRuntimeVersionHelper.getFunctionsRuntimeMajorVersion(runtimeVersion);

  const hasCustomRuntimeVersion = runtimeMajorVersion === RuntimeExtensionMajorVersions.custom;
  const shouldEnableForV4 =
    runtimeVersion === RuntimeExtensionMajorVersions.v4 &&
    !!runtimeStack &&
    !!initialRuntimeStack &&
    runtimeStack.toLowerCase() === initialRuntimeStack.toLowerCase() &&
    initialRuntimeStack.toLowerCase() !== WorkerRuntimeLanguages.dotnet;
  let [waitingOnFunctionsApi, hasFunctions, failedToGetFunctions] = [false, false, false];

  const [movingFromV2Warning, setMovingFromV2Warning] = useState<string | undefined>(undefined);

  switch (asyncData.functionsCount.loadingState) {
    case LoadingStates.loading:
      // The functions call hasn't completed, so we don't know the functions count. Keep the control disabled until the call completes or fails.
      waitingOnFunctionsApi = true;
      break;
    case LoadingStates.complete:
      // The functions call completed successfully. If the function count > 0 , prevent the user from changing major versions.
      hasFunctions = !!asyncData.functionsCount.value;
      break;
    case LoadingStates.failed:
      // The functions call failed, so we don't know the functions count. To be safe, prevent the user from changing major versions.
      failedToGetFunctions = true;
      break;
  }

  const getPlaceHolder = (): string => {
    if (waitingOnFunctionsApi && !hasCustomRuntimeVersion) {
      return t('loading');
    }

    if (failedToGetFunctions) {
      return t('loadingFailed');
    }

    return '';
  };

  const getRuntimeVersionInUse = () => {
    let runtimeVersionInUse: RuntimeExtensionMajorVersions | null = null;

    if (
      asyncData.functionsHostStatus.loadingState === LoadingStates.complete &&
      asyncData.functionsHostStatus.value &&
      asyncData.functionsHostStatus.value.properties.state !== HostStates.error
    ) {
      // Try to get the current running major version from the result of the host status call.
      runtimeVersionInUse = FunctionsRuntimeVersionHelper.parseExactRuntimeVersion(asyncData.functionsHostStatus.value!.properties.version);
    }

    if (!runtimeVersionInUse) {
      // We weren't able to determine the major version because the host status call failed or returned a null/invalid value.
      // Try to get the intended major version based off of the FUNCTIONS_EXTENSION_VERSION value configured
      runtimeVersionInUse = FunctionsRuntimeVersionHelper.parseConfiguredRuntimeVersion(initialRuntimeVersion);
    }

    return runtimeVersionInUse;
  };

  const isV2Hidden = () => {
    return initialRuntimeMajorVersion !== RuntimeExtensionMajorVersions.v2;
  };

  const getOptions = (): IDropdownOption[] => {
    if (hasCustomRuntimeVersion) {
      // NOTE(shimedh): When we move to using stacks API, this should be driven by the versions supported by a particular stack.
      if (shouldEnableForV4) {
        return [
          {
            key: RuntimeExtensionMajorVersions.v3,
            text: RuntimeExtensionMajorVersions.v3,
          },
          {
            key: RuntimeExtensionMajorVersions.custom,
            text: RuntimeExtensionMajorVersions.v4,
          },
        ];
      } else {
        return [
          {
            key: RuntimeExtensionMajorVersions.custom,
            text: runtimeVersion === RuntimeExtensionMajorVersions.v4 ? RuntimeExtensionMajorVersions.v4 : t('custom'),
          },
        ];
      }
    }

    return [
      {
        key: RuntimeExtensionMajorVersions.v1,
        text: RuntimeExtensionMajorVersions.v1,
        disabled: isLinuxApp(values.site),
      },
      {
        key: RuntimeExtensionMajorVersions.v2,
        text: RuntimeExtensionMajorVersions.v2,
        hidden: isV2Hidden(),
      },
      {
        key: RuntimeExtensionMajorVersions.v3,
        text: RuntimeExtensionMajorVersions.v3,
      },
    ];
  };

  const dropDownDisabled = (): boolean => waitingOnFunctionsApi || failedToGetFunctions || (hasCustomRuntimeVersion && !shouldEnableForV4);

  const getNodeVersionForRuntime = version => {
    switch (version) {
      case RuntimeExtensionMajorVersions.v2:
        return CommonConstants.NodeVersions.v2;
      case RuntimeExtensionMajorVersions.v3:
        return CommonConstants.NodeVersions.v3;
      default:
        return CommonConstants.NodeVersions.default;
    }
  };

  const isExistingFunctionsWarningNeeded = (newVersion: RuntimeExtensionMajorVersions) =>
    hasFunctions && !isVersionChangeSafe(newVersion, getRuntimeVersionInUse());

  const onDropDownChange = (newVersion: RuntimeExtensionMajorVersions) => {
    setMovingFromV2Warning(undefined);
    if (isExistingFunctionsWarningNeeded(newVersion)) {
      setPendingVersion(newVersion);
    } else {
      if (newVersion === RuntimeExtensionMajorVersions.v3 && initialRuntimeMajorVersion === RuntimeExtensionMajorVersions.v2) {
        setMovingFromV2Warning(t('movingFromV2Warning'));
      }
      updateDropDownValue(newVersion);
    }
  };

  const onVersionChangeConfirm = () => {
    updateDropDownValue(pendingVersion!);
    setPendingVersion(undefined);
  };

  const onVersionChangeDismiss = () => {
    setPendingVersion(undefined);
  };

  const updateDropDownValue = (newVersion: RuntimeExtensionMajorVersions) => {
    let appSettings: FormAppSetting[] = [...values.appSettings];

    // Remove AZUREJOBS_EXTENSION_VERSION app setting (if present)
    appSettings = removeFromAppSetting(values.appSettings, CommonConstants.AppSettingNames.azureJobsExtensionVersion);

    if (newVersion === RuntimeExtensionMajorVersions.v1) {
      // If functions extension version is V1, remove FUNCTIONS_WORKER_RUNTIME app setting (if present)
      appSettings = removeFromAppSetting(values.appSettings, CommonConstants.AppSettingNames.functionsWorkerRuntime);
    } else {
      // If functions extension version is not V1, restore the initial value for FUNCTIONS_WORKER_RUNTIME app setting (if present)
      const initialWorkerRuntime = findFormAppSettingValue(
        initialValues.appSettings,
        CommonConstants.AppSettingNames.functionsWorkerRuntime
      );
      if (initialWorkerRuntime) {
        appSettings = addOrUpdateFormAppSetting(
          values.appSettings,
          CommonConstants.AppSettingNames.functionsWorkerRuntime,
          initialWorkerRuntime
        );
      }
    }

    // Add or update WEBSITE_NODE_DEFAULT_VERSION app setting
    const nodeVersion = getNodeVersionForRuntime(newVersion);
    appSettings = addOrUpdateFormAppSetting(values.appSettings, CommonConstants.AppSettingNames.websiteNodeDefaultVersion, nodeVersion);

    // Add or update FUNCTIONS_EXTENSION_VERSION app setting
    // NOTE(shimedh): We need to make sure the version is set to ~4 instead of custom for all enabled cases so that the dropdown is not disabled after change.
    if (shouldEnableForV4 && newVersion === RuntimeExtensionMajorVersions.custom) {
      newVersion = RuntimeExtensionMajorVersions.v4;
    }
    appSettings = addOrUpdateFormAppSetting(values.appSettings, CommonConstants.AppSettingNames.functionsExtensionVersion, newVersion);

    setFieldValue('appSettings', appSettings);
  };

  const customVersionMessage =
    runtimeMajorVersion === RuntimeExtensionMajorVersions.custom && runtimeVersion !== RuntimeExtensionMajorVersions.v4
      ? t('functionsRuntimeVersionCustomInfo')
      : undefined;

  const existingFunctionsMessage = isExistingFunctionsWarningNeeded(runtimeMajorVersion)
    ? t('functionsRuntimeVersionExistingFunctionsWarning').format(getRuntimeVersionInUse(), runtimeMajorVersion)
    : undefined;

  useEffect(() => {
    setMovingFromV2Warning(undefined);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRuntimeVersion]);
  return (
    <>
      {app_write && editable ? (
        <>
          <ConfirmDialog
            primaryActionButton={{
              title: t('continue'),
              onClick: onVersionChangeConfirm,
            }}
            defaultActionButton={{
              title: t('cancel'),
              onClick: onVersionChangeDismiss,
            }}
            title={t('functionsRuntimeVersionExistingFunctionsConfirmationTitle')}
            content={t('functionsRuntimeVersionExistingFunctionsConfirmationMessage').format(getRuntimeVersionInUse(), pendingVersion)}
            hidden={!pendingVersion}
            onDismiss={onVersionChangeDismiss}
          />
          {existingFunctionsMessage && (
            <CustomBanner
              id="function-app-settings-runtime-version-message"
              message={existingFunctionsMessage}
              type={MessageBarType.warning}
              undocked={true}
            />
          )}
          {movingFromV2Warning && (
            <CustomBanner
              id="function-app-settings-runtime-version-v2-change-message"
              message={movingFromV2Warning}
              type={MessageBarType.warning}
              undocked={true}
              learnMoreLink={Links.functionV2MigrationLearnMore}
            />
          )}
          <DropdownNoFormik
            placeHolder={getPlaceHolder()}
            selectedKey={runtimeMajorVersion}
            dirty={runtimeMajorVersion !== initialRuntimeMajorVersion}
            onChange={(event, option) => onDropDownChange(option ? option.key : undefined)}
            options={getOptions()}
            disabled={disableAllControls || dropDownDisabled()}
            label={t('runtimeVersion')}
            id="function-app-settings-runtime-version"
            infoBubbleMessage={customVersionMessage}
          />
        </>
      ) : (
        <DropdownNoFormik
          onChange={() => null}
          options={[]}
          disabled={true}
          label={t('runtimeVersion')}
          id="function-app-settings-runtime-version"
        />
      )}
    </>
  );
};

export default withTranslation('translation')(RuntimeVersion);
